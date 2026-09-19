// Converts src/components/icons.tsx (SVG-in-JSX, 24x24 stroke icons) into
// Android VectorDrawable XML. Brand marks (Google/Waze/Apple) are excluded —
// those must use each vendor's official Android asset.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2];
const OUT = process.argv[3];
const SKIP = new Set(['IconGoogleG', 'IconGoogleMaps', 'IconWaze', 'IconAppleMaps']);

const src = readFileSync(SRC, 'utf8');
mkdirSync(OUT, { recursive: true });

const n = (v) => {
  const x = Number(v);
  return String(Math.round(x * 1000) / 1000);
};

function circlePath(cx, cy, r) {
  cx = Number(cx); cy = Number(cy); r = Number(r);
  return `M${n(cx - r)},${n(cy)} a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0 a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0 Z`;
}
function ellipsePath(cx, cy, rx, ry) {
  cx = Number(cx); cy = Number(cy); rx = Number(rx); ry = Number(ry);
  return `M${n(cx - rx)},${n(cy)} a${n(rx)},${n(ry)} 0 1,0 ${n(2 * rx)},0 a${n(rx)},${n(ry)} 0 1,0 ${n(-2 * rx)},0 Z`;
}
function rectPath(x, y, w, h, rx) {
  x = Number(x || 0); y = Number(y || 0); w = Number(w); h = Number(h); rx = Number(rx || 0);
  if (!rx) return `M${n(x)},${n(y)} H${n(x + w)} V${n(y + h)} H${n(x)} Z`;
  return [
    `M${n(x + rx)},${n(y)}`,
    `H${n(x + w - rx)}`,
    `A${n(rx)},${n(rx)} 0 0,1 ${n(x + w)},${n(y + rx)}`,
    `V${n(y + h - rx)}`,
    `A${n(rx)},${n(rx)} 0 0,1 ${n(x + w - rx)},${n(y + h)}`,
    `H${n(x + rx)}`,
    `A${n(rx)},${n(rx)} 0 0,1 ${n(x)},${n(y + h - rx)}`,
    `V${n(y + rx)}`,
    `A${n(rx)},${n(rx)} 0 0,1 ${n(x + rx)},${n(y)}`,
    'Z',
  ].join(' ');
}

const attrs = (s) => {
  const out = {};
  for (const m of s.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
};

const snake = (name) =>
  'ic_' + name.replace(/^Icon/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

const chunks = src.split(/\nexport const /).slice(1);
const made = [];

for (const chunk of chunks) {
  const name = chunk.match(/^(Icon\w+)/)?.[1];
  if (!name || SKIP.has(name)) continue;

  const paths = [];
  for (const m of chunk.matchAll(/<(path|circle|rect|ellipse)\s+([^>]*?)\/>/g)) {
    const [, tag, raw] = m;
    const a = attrs(raw);
    let d;
    if (tag === 'path') d = a.d;
    else if (tag === 'circle') d = circlePath(a.cx, a.cy, a.r);
    else if (tag === 'ellipse') d = ellipsePath(a.cx, a.cy, a.rx, a.ry);
    else d = rectPath(a.x, a.y, a.width, a.height, a.rx);
    if (!d) continue;
    // A sub-path may opt out of stroking and be filled instead (IconContrast).
    const filled = a.fill === 'currentColor' && a.stroke === 'none';
    paths.push({ d, filled });
  }
  if (!paths.length) continue;

  const body = paths
    .map(({ d, filled }) =>
      filled
        ? `    <path\n        android:fillColor="#FF000000"\n        android:pathData="${d}" />`
        : `    <path\n        android:pathData="${d}"\n        android:strokeColor="#FF000000"\n        android:strokeWidth="1.75"\n        android:strokeLineCap="round"\n        android:strokeLineJoin="round" />`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- wheretopark.sg icon: ${name}. Generated from src/components/icons.tsx. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
${body}
</vector>
`;
  const file = snake(name) + '.xml';
  writeFileSync(join(OUT, file), xml, 'utf8');
  made.push(`${name} -> ${file} (${paths.length} path${paths.length > 1 ? 's' : ''})`);
}

console.log(made.join('\n'));
console.log(`\n${made.length} icons written to ${OUT}`);
