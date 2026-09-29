"""Extract HDB carparks with motorcycle lots from the community
"SG Motorcycle Parking" Google My Map (r/singapore, Dec 2022).

HDB's live availability feed has no motorcycle ("Y") rows, so this map is
our only signal for which HDB carparks have motorcycle lots.

  python3 scripts/extract-hdb-motorcycle.py
Writes src/lib/data/hdbMotorcycle.json: [[lat, lng, "ADDRESS"], ...]
"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
kml = (root / 'scripts/data/sources/sg-motorcycle-parking.kml').read_text()
out = []
for name, body in re.findall(r'<Folder>\s*<name>(.*?)</name>(.*?)</Folder>', kml, re.S):
    if not name.startswith('HDB'):
        continue
    for p in re.findall(r'<Placemark>(.*?)</Placemark>', body, re.S):
        lng, lat = map(float, re.search(r'<coordinates>\s*([\d.]+),([\d.]+)', p).groups())
        addr = re.search(r'<name>(.*?)</name>', p).group(1).strip().upper()
        out.append([round(lat, 6), round(lng, 6), addr])
(root / 'src/lib/data/hdbMotorcycle.json').write_text(json.dumps(out, separators=(',', ':')))
print(len(out), 'HDB motorcycle carparks')
