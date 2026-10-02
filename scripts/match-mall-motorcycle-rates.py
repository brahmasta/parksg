"""Match the community motorcycle prices (scripts/data/mall-motorcycle-rates.json,
from extract-mall-motorcycle-rates.py) to our carparks, and write the
migration that inserts them as motorcycle rate rows.

A pin matches the carpark within 200m whose name agrees: identical core words
(after dropping "the", "shopping centre", "(Formerly ...)" and the like), the
shorter name contained in the longer with at most one extra word, or a close
spelling (difflib ratio >= 0.75). HDB and URA carparks are skipped — HDB's
motorcycle rate is a flat national rate and URA publishes its own. Carparks
that already have motorcycle rows are left alone. REJECT lists matches
checked by hand and found wrong.

Reads carparks through the public PostgREST API with the anon key in
.env.local (read-only). Never writes to the database itself.

  python3 scripts/match-mall-motorcycle-rates.py
Writes scripts/data/mall-motorcycle-matches.json and
db/migrations/017_mall_motorcycle_rates.sql.
"""
import difflib, json, math, pathlib, re, urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
env = dict(
    l.split('=', 1)
    for l in (root / '.env.local').read_text().splitlines()
    if '=' in l and not l.startswith('#')
)
URL, KEY = env['VITE_SUPABASE_URL'].strip(), env['VITE_SUPABASE_ANON_KEY'].strip()

# Wrong matches found by hand: (pin name, carpark id it must not match).
REJECT = {
    ('Hotel Jen Tanglin Singapore (Formerly Traders Hotel)', 'LTA:tanglin_mall'),
    ('Central Square', 'LTA:central_mall'),
}

STOP = {'the', 'singapore', 'shopping', 'centre', 'center', 'mall', 'building', 'complex', 'plaza',
        'hotel', 'car', 'park', 'carpark', 'and', 'of', 'at', 'formerly', 'basement', 'multi', 'storey'}


def get(path):
    req = urllib.request.Request(f'{URL}/rest/v1/{path}', headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    return json.load(urllib.request.urlopen(req))


def core(name):
    n = re.sub(r'\(.*?\)', ' ', name.lower()).replace('&', ' and ').replace('@', ' ')
    return [t for t in re.findall(r'[a-z0-9]+', n) if t not in STOP]


def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a['lat'], a['lng'], b['lat'], b['lng']))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def name_score(a, b):
    ta, tb = core(a), core(b)
    if not ta or not tb:
        return 0.0
    sa, sb = set(ta), set(tb)
    if sa == sb:
        return 1.0
    small, big = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
    # Containment only counts when the shorter name is distinctive (2+ words)
    # and the longer adds just one word: "Mount Alvernia Hospital" in "Mount
    # Alvernia Hospital and Medical Centre", not "Tampines" in "Tampines One".
    if len(small) >= 2 and small <= big and len(big) - len(small) <= 1:
        return 0.95
    return difflib.SequenceMatcher(None, ' '.join(ta), ' '.join(tb)).ratio()


def q(s):
    return "'" + s.replace("'", "''") + "'"


def row_values(m):
    if m['kind'] == 'block':
        per_block, block, entry = m['cents'], m['block_minutes'], 'null'
    else:  # 'entry' / 'free': per-entry rows store a 0/0 block (NOT NULL columns)
        per_block, block, entry = 0, 0, m['cents']
    grace = m['grace_minutes'] if m['grace_minutes'] is not None else 'null'
    return [f"({q(m['carpark_id'])}, {q(day)}, {per_block}, {block}, {entry}, {grace})"
            for day in ('WEEKDAY', 'SAT', 'SUN_PH')]


cps = []
for off in range(0, 20000, 1000):
    page = get(f'carparks?select=id,name,agency,lat,lng&lat=not.is.null&order=id&limit=1000&offset={off}')
    cps += page
    if len(page) < 1000:
        break
has_moto = {r['carpark_id'] for r in get('rate_rows?select=carpark_id&veh_cat=eq.MOTORCYCLE&limit=20000')}
pins = json.loads((root / 'scripts/data/mall-motorcycle-rates.json').read_text(encoding='utf-8'))

matched, unmatched = [], []
for p in pins:
    best = None
    for c in cps:
        if c['agency'] in ('HDB', 'URA') or (p['name'], c['id']) in REJECT:
            continue
        d = dist(p, c)
        if d > 200:
            continue
        s = name_score(p['name'], c['name'])
        if s >= 0.75 and (best is None or (s, -d) > (best[0], -best[1])):
            best = (s, d, c)
    if best:
        s, d, c = best
        matched.append({**p, 'carpark_id': c['id'], 'carpark_name': c['name'],
                        'dist_m': round(d), 'score': round(s, 2)})
    else:
        unmatched.append(p['name'])

# One pin per carpark — the first in the map wins (duplicates like the two
# *SCAPE pins carry the same price) — and never a carpark that already has
# motorcycle rates.
seen, unique = set(), []
for m in matched:
    if m['carpark_id'] in seen or m['carpark_id'] in has_moto:
        continue
    seen.add(m['carpark_id'])
    unique.append(m)

(root / 'scripts/data/mall-motorcycle-matches.json').write_text(
    json.dumps(unique, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')

values = ',\n  '.join(v for m in unique for v in row_values(m))
sql = f"""-- Migration: motorcycle prices for malls and offices, from the community map
--
-- Generated by scripts/match-mall-motorcycle-rates.py — edit the scripts and
-- re-run them rather than this file.
--
-- {len(unique)} non-HDB, non-URA carparks get a motorcycle price from the
-- r/singapore "SG Motorcycle Parking" Google My Map (Dec 2022). One schedule
-- per carpark, the same every day (the map doesn't split by day). Rows are
-- source = 'COMMUNITY' (migration 016) with effective_from 2022-12-01, so the
-- app can label them as rider-reported and dated.
--
-- Only inserts for carparks that exist and have no motorcycle rows yet, so it
-- is safe to re-run and never overrides URA or hand-entered motorcycle rates.

insert into public.rate_rows
  (carpark_id, day_type, start_time, end_time, per_block_cents, block_minutes,
   per_entry_cents, grace_minutes, system, veh_cat, source, effective_from)
select v.carpark_id, v.day_type::day_type, null, null, v.per_block_cents, v.block_minutes,
       v.per_entry_cents, v.grace_minutes, 'GANTRY_PRIVATE', 'MOTORCYCLE', 'COMMUNITY', date '2022-12-01'
from (values
  {values}
) as v(carpark_id, day_type, per_block_cents, block_minutes, per_entry_cents, grace_minutes)
where exists (select 1 from public.carparks c where c.id = v.carpark_id)
  and not exists (
    select 1 from public.rate_rows r
    where r.carpark_id = v.carpark_id and r.veh_cat = 'MOTORCYCLE'
  );
"""
(root / 'db/migrations/017_mall_motorcycle_rates.sql').write_text(sql, encoding='utf-8')

print(len(cps), 'carparks;', len(unique), 'carparks priced;', len(unmatched), 'pins unmatched')
for m in sorted(unique, key=lambda m: (m['score'], -m['dist_m'])):
    if core(m['name']) != core(m['carpark_name']) or m['dist_m'] > 100:
        print(f"  check {m['score']} {m['dist_m']}m | {m['name']} -> {m['carpark_name']} ({m['carpark_id']})")
