"""Extract motorcycle prices for malls, offices and other non-HDB carparks from
the community "SG Motorcycle Parking" Google My Map (r/singapore, Dec 2022).

The map's "Motorcycle Parking Lots" folder has ~440 pins with a free-text
"Remarks" price. Only remarks with one unambiguous price are kept:

  Free | Free. Limited lots                    -> free
  $X/entry | $X per entry [. N min grace ...]  -> per entry
  Public: $X/entry. Member: ...                -> per entry (public price)
  $X  (bare, X <= 1.50)                        -> per entry
  $X/hr | $X/hour [or part thereof]            -> per 60 min
  $X/half hour | $X/ half hour                 -> per 30 min

A trailing sentence of advice ("Use gantry on the right", "10 min grace
period") is allowed if it holds no other price and doesn't change what the
price means — advice mentioning free times, season holders, coupon or street
parking, or another place ("opposite", "nearby") rejects the pin. A grace
period in the advice is kept. Everything else — OOB, season/tenants only, multi-band
schedules, prorated, RM prices, bare amounts over $1.50 (could be hourly),
remarks that send you to another carpark — is skipped and counted.

The URA and HDB folders are ignored: URA motorcycle rates come from URA's own
API, and HDB's are a flat national rate (src/lib/hdbMotorcycle.ts).

  python3 scripts/extract-mall-motorcycle-rates.py
Writes scripts/data/mall-motorcycle-rates.json:
  [{"name", "address", "lat", "lng", "remark", "kind", "cents", "block_minutes", "grace_minutes"}]
"""
import collections, html, json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
kml = (root / 'scripts/data/sources/sg-motorcycle-parking.kml').read_text(encoding='utf-8')

MONEY = r'\$(\d+(?:\.\d{1,2})?)'
REST = r'(?:\.\s+(?P<rest>[^$]*))?$'  # optional advice sentence, no other price


def cents(s):
    return round(float(s) * 100)


QUALIFIES = re.compile(r'free|opposite|nearby|coupon|street|season', re.I)


def parse(remark):
    """Return ((kind, cents, block_minutes, grace_minutes), None) or (None, reason)."""
    r = re.sub(r'\s+', ' ', remark).strip()
    parsed, reason = parse_price(r)
    if not parsed:
        return None, reason
    rest = r.split('. ', 1)[1] if '. ' in r and not r.lower().startswith('public:') else ''
    if QUALIFIES.search(rest):
        return None, 'advice qualifies the price'
    grace = re.search(r'(\d+)\s*mins?\s*grace', rest, re.I)
    kind, c, block, g = parsed
    return (kind, c, block, g or (int(grace.group(1)) if grace else None)), None


def parse_price(r):
    if not r:
        return None, 'empty'
    if re.fullmatch(r'free(\. limited lots)?\.?', r, re.I):
        return ('free', 0, None, None), None
    m = re.fullmatch(MONEY + r'\s*(?:/\s*entry|per entry)(?:\.\s*(\d+)\s*min(?:s|ute)?s? grace period)?' + REST, r, re.I)
    if m:
        return ('entry', cents(m.group(1)), None, int(m.group(2)) if m.group(2) else None), None
    m = re.fullmatch(r'public:\s*' + MONEY + r'\s*/\s*entry\.\s*member:.*', r, re.I)
    if m:
        return ('entry', cents(m.group(1)), None, None), None
    m = re.fullmatch(MONEY + REST, r)
    if m:
        if float(m.group(1)) > 1.5:
            return None, 'bare amount over $1.50'
        return ('entry', cents(m.group(1)), None, None), None
    m = re.fullmatch(MONEY + r'\s*/\s*(hr|hour)(?: or part thereof)?' + REST, r, re.I)
    if m and not re.search(r'prorat', r, re.I):
        return ('block', cents(m.group(1)), 60, None), None
    m = re.fullmatch(MONEY + r'\s*/\s*half hour' + REST, r, re.I)
    if m:
        return ('block', cents(m.group(1)), 30, None), None
    return None, 'not a single clear price'


folders = dict(re.findall(r'<Folder>\s*<name>(.*?)</name>(.*?)</Folder>', kml, re.S))
body = next(v for k, v in folders.items() if k.startswith('Motorcycle Parking Lots'))

out, skipped = [], collections.Counter()
for p in re.findall(r'<Placemark>(.*?)</Placemark>', body, re.S):
    name = html.unescape(re.search(r'<name>(.*?)</name>', p, re.S).group(1)).strip()
    lng, lat = map(float, re.search(r'<coordinates>\s*([\d.]+),([\d.]+)', p).groups())
    desc = re.search(r'<!\[CDATA\[(.*?)\]\]>', p, re.S)
    desc = html.unescape(desc.group(1)) if desc else ''
    addr = re.search(r'Address:<br>(.*?)<br>', desc)
    remark = desc.split('Remarks:<br>')[-1] if 'Remarks:' in desc else ''
    remark = re.sub(r'<br>', ' ', remark).strip()
    parsed, reason = parse(remark)
    if not parsed:
        skipped[reason] += 1
        continue
    kind, c, block, grace = parsed
    out.append({
        'name': name,
        'address': addr.group(1).strip() if addr else None,
        'lat': round(lat, 6),
        'lng': round(lng, 6),
        'remark': re.sub(r'\s+', ' ', remark),
        'kind': kind,
        'cents': c,
        'block_minutes': block,
        'grace_minutes': grace,
    })

(root / 'scripts/data/mall-motorcycle-rates.json').write_text(
    json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print(len(out), 'priced pins kept;', sum(skipped.values()), 'skipped:', dict(skipped))
print(collections.Counter(o['kind'] for o in out))
