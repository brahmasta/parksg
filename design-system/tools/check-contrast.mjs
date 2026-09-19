import { readFileSync } from 'node:fs';
const T = JSON.parse(readFileSync('design-system/tokens.json', 'utf8'));

const hex = (h) => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
const lin = (c) => { c/=255; return c<=0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4; };
const L = (h) => { const [r,g,b]=hex(h); return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b); };
// Flatten an alpha colour over a backdrop before measuring (dark theme uses these).
const over = (fg, a, bg) => {
  const f=hex(fg), b=hex(bg);
  return '#'+f.map((v,i)=>Math.round(v*a+b[i]*(1-a)).toString(16).padStart(2,'0')).join('');
};
const ratio = (a,b) => { const l1=L(a), l2=L(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };

const TEXT = ['text1','text2','text3','ok','warn','bad','accent','accentBlue','mutedStatus'];
const OUTLINE = ['line','lineStrong'];
let fails = 0;

for (const [id, theme] of Object.entries(T.themes)) {
  const c = theme.color;
  const flat = (k) => c[k].alpha ? over(c[k].value, c[k].alpha, c.bg1.value) : c[k].value;
  console.log(`\n── ${id} (${theme.$label}) ─ text on bg1 ${c.bg1.value}`);
  for (const k of TEXT) {
    const r = ratio(flat(k), c.bg1.value);
    const ok = r >= 4.5;
    if (!ok) fails++;
    console.log(`  ${ok?'PASS':'FAIL'}  ${k.padEnd(12)} ${r.toFixed(2)}:1  ${c[k].wcag ? '(claimed '+c[k].wcag+')' : ''}`);
  }
  for (const k of OUTLINE) {
    const r = ratio(flat(k), c.bg1.value);
    const need = k === 'lineStrong' ? 3.0 : 0;
    const ok = r >= need;
    if (!ok) fails++;
    console.log(`  ${ok?'PASS':'FAIL'}  ${k.padEnd(12)} ${r.toFixed(2)}:1  (needs ${need}:1)`);
  }
  // accentOn on accent — the primary button.
  const btn = ratio(c.accentOn.value, c.accent.value);
  console.log(`  ${btn>=4.5?'PASS':'FAIL'}  ${'accentOn/accent'.padEnd(12)} ${btn.toFixed(2)}:1`);
  if (btn < 4.5) fails++;
}
console.log(`\n${fails} token(s) below their floor.`);
