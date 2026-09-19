// Builds design-system/preview.html — a visual proof sheet rendered ENTIRELY
// from tokens.json. If a token is transcribed wrong, this page shows it wrong,
// which is the point: it checks the export rather than illustrating it.
//
//   node design-system/tools/build-preview.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'design-system';
const T = JSON.parse(readFileSync(join(ROOT, 'tokens.json'), 'utf8'));

/** Resolve a token to a CSS colour, flattening alpha where the export records it. */
const val = (t) => (t.argb ? argbToRgba(t.argb) : t.value);
const argbToRgba = (argb) => {
  const h = argb.replace('#', '');
  const a = parseInt(h.slice(0, 2), 16) / 255;
  return `rgba(${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${parseInt(h.slice(6, 8), 16)},${a.toFixed(3)})`;
};

/** Pull an icon's paths out of a generated VectorDrawable so the sheet uses the real assets. */
function icon(name, size = 16) {
  const xml = readFileSync(join(ROOT, 'android/res/drawable', `${name}.xml`), 'utf8');
  const paths = [...xml.matchAll(/<path\b([\s\S]*?)\/>/g)]
    .map((m) => {
      const d = m[1].match(/android:pathData="([^"]*)"/)[1];
      return /android:fillColor/.test(m[1])
        ? `<path d="${d}" fill="currentColor"/>`
        : `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="flex:none">${paths}</svg>`;
}

const cssVars = (theme) =>
  Object.entries(theme.color)
    .map(([k, v]) => `--${k}:${val(v)}`)
    .join(';');

const SWATCH_GROUPS = [
  ['Surfaces', ['bg0', 'bg1', 'bg2', 'bg3']],
  ['Lines', ['line', 'lineStrong']],
  ['Text', ['text1', 'text2', 'text3']],
  ['Status', ['ok', 'okBg', 'warn', 'warnBg', 'bad', 'badBg', 'mutedStatus', 'mutedStatusBg']],
  ['Accent', ['accent', 'accentOn', 'accentTint', 'accentTintStrong', 'accentBlue', 'accentBlueBg']],
  ['Sources', ['srcHdb', 'srcUra', 'srcLta', 'srcEv']],
];

const swatches = (theme) =>
  SWATCH_GROUPS.map(
    ([label, keys]) => `
    <div class="grp">
      <div class="eyebrow">${label}</div>
      <div class="sw-row">
        ${keys
          .map(
            (k) => `<div class="sw">
              <i style="background:${val(theme.color[k])}"></i>
              <b>${k}</b><span>${theme.color[k].value}</span>
            </div>`,
          )
          .join('')}
      </div>
    </div>`,
  ).join('');

const typeLadder = Object.entries(T.type)
  .filter(([k]) => !k.startsWith('$'))
  .map(([k, s]) => {
    const brand = s.font === 'brand';
    const caps = s.allCaps ? 'text-transform:uppercase;' : '';
    return `<div class="tr">
      <code>${k}</code>
      <div style="font-size:${s.size}px;font-weight:${s.weight};letter-spacing:${s.letterSpacing ?? 0}px;${caps}font-family:${brand ? 'var(--f-brand)' : 'var(--f-body)'}">$12.50 · Marina Bay</div>
      <small>${s.size}/${s.weight}</small>
    </div>`;
  })
  .join('');

const card = (opts) => `
  <div class="card ${opts.active ? 'active' : ''}">
    <div class="row top">
      <div class="col grow">
        <div class="row meta">
          <span class="rank ${opts.cheapest ? 'hot' : ''}">#${opts.rank}</span>
          <span class="badge">${opts.operator}</span>
          ${opts.ev ? `<span class="badge ev">${icon('ic_bolt', 11)}${opts.ev}</span>` : ''}
          ${opts.stale ? '<span class="badge stale">2018 rate</span>' : ''}
          ${opts.cheapest ? '<span class="badge cheapest">Cheapest</span>' : ''}
        </div>
        <div class="name">${opts.name}</div>
        <div class="block">${opts.block}</div>
      </div>
      <div class="col right">
        <div class="cost">${opts.cost}</div>
        <div class="cost-cap ${opts.stale ? 'warnish' : ''}">${opts.caption}</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="row bottom">
      <div class="row walk">${icon('ic_walk', 14)}<span>${opts.walk} min</span><span class="dim">·</span><span class="dim">${opts.dist}</span></div>
      <div class="row lots">
        <i class="dot ${opts.status}"></i>
        <span class="lots-label ${opts.status}">${opts.lots}</span>
      </div>
    </div>
  </div>`;

const components = () => `
  <div class="stack">
    <div class="wordmark">
      <i class="tile">P</i><span class="wm">wheretopark<em>.sg</em></span>
    </div>

    <div class="search">
      ${icon('ic_search', 18)}
      <span class="ph">Where to?</span>
      <i class="clear">${icon('ic_close', 12)}</i>
      <i class="go">${icon('ic_chevron_right', 16)}</i>
    </div>

    <div class="row pills">
      <button class="pill on"><i class="pdot"></i>Available</button>
      <button class="pill">${icon('ic_bolt', 13)}EV</button>
      <button class="pill">Covered</button>
    </div>

    <div class="row pills">
      <button class="dur on">30 min</button>
      <button class="dur">1 hr</button>
      <button class="dur">2 hr</button>
      <button class="dur">4 hr+</button>
    </div>

    ${card({ rank: 1, operator: 'URA', name: 'Marina Bay Sands', block: '10 Bayfront Ave', cost: '$12.00', caption: 'Est · 2 hr', walk: 4, dist: '310m', lots: '243 lots', status: 'ok', cheapest: true, ev: 6 })}
    ${card({ rank: 2, operator: 'HDB', name: 'Blk 335 Smith Street', block: 'Chinatown', cost: '$3.20', caption: 'Est · 2018', walk: 7, dist: '540m', lots: '4 lots', status: 'warn', stale: true })}
    ${card({ rank: 3, operator: 'LTA', name: 'Suntec City North', block: '3 Temasek Blvd', cost: '—', caption: 'Rate unknown', walk: 9, dist: '1.1km', lots: 'Full', status: 'bad', active: true })}

    <div class="toast">
      <i class="ttile">${icon('ic_check', 16)}</i>
      <div><b>Saved to your list</b><span>Marina Bay Sands</span></div>
    </div>

    <button class="cta">${icon('ic_navigate', 18)}Navigate</button>

    <div class="sheet"><i class="handle"></i><div class="sheet-body">Bottom sheet</div></div>
  </div>`;

const panel = (id, theme) => `
  <section class="theme" style="${cssVars(theme)}">
    <header>
      <h2>${theme.$label}${theme.$default ? ' <span class="tag">default</span>' : ''}</h2>
      <p>${theme.$blurb}</p>
      ${theme.$a11yWarning ? '<p class="warnbox">Below WCAG AA on several tokens — opt-in only. See tokens.json.</p>' : ''}
    </header>
    <div class="body">
      ${swatches(theme)}
      <div class="grp"><div class="eyebrow">Components</div>${components()}</div>
    </div>
  </section>`;

const iconNames = readdirSync(join(ROOT, 'android/res/drawable'))
  .filter((f) => f.endsWith('.xml'))
  .map((f) => f.replace('.xml', ''));

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>wheretopark.sg — design system</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--f-body:'Plus Jakarta Sans',system-ui,sans-serif;--f-brand:'Space Grotesk',system-ui,sans-serif}
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--f-body);background:#20242b;color:#e8ecf2;font-variant-numeric:tabular-nums}
  .page{max-width:1500px;margin:0 auto;padding:28px 20px 60px}
  .lede{max-width:760px;margin:0 0 26px}
  .lede h1{font-size:26px;letter-spacing:-.6px;margin:0 0 6px}
  .lede p{margin:0;color:#98a3b3;font-size:13.5px;line-height:1.55}
  .themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:18px;align-items:start}
  .theme{background:var(--bg0);border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}
  .theme header{padding:16px 18px 12px;background:var(--bg1);border-bottom:.5px solid var(--line)}
  .theme h2{margin:0;font-size:17px;color:var(--text1);letter-spacing:-.3px}
  .theme header p{margin:3px 0 0;font-size:12px;color:var(--text3)}
  .tag{font-size:9.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;background:var(--accent);color:var(--accentOn);padding:2px 6px;border-radius:4px;vertical-align:2px}
  .warnbox{margin-top:8px!important;background:var(--warnBg);color:var(--warn);padding:7px 9px;border-radius:8px;font-size:11px!important;line-height:1.4}
  .body{padding:16px 18px 22px}
  .grp{margin-bottom:20px}
  .eyebrow{font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:9px}
  .sw-row{display:flex;flex-wrap:wrap;gap:7px}
  .sw{width:78px}
  .sw i{display:block;height:34px;border-radius:8px;border:.5px solid var(--lineStrong)}
  .sw b{display:block;font-size:9.5px;font-weight:600;color:var(--text2);margin-top:4px}
  .sw span{display:block;font-size:8.5px;color:var(--text3)}

  .stack{display:flex;flex-direction:column;gap:12px}
  .row{display:flex;align-items:center}
  .col{display:flex;flex-direction:column}
  .grow{flex:1;min-width:0}.right{align-items:flex-end;flex:none}

  .wordmark{display:flex;align-items:center;gap:9px}
  .tile{width:26px;height:26px;border-radius:10px;display:grid;place-items:center;font-family:var(--f-brand);font-weight:700;font-size:17px;font-style:normal;
    background:linear-gradient(145deg,#2EE3C2,#14C9B6);color:#0B2E2A;box-shadow:0 4px 13px rgba(46,227,194,.45)}
  .wm{font-family:var(--f-brand);font-size:19px;font-weight:700;letter-spacing:-.4px;color:var(--text1)}
  .wm em{font-style:normal;font-weight:500;color:var(--text3)}

  .search{display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--bg2);border:.5px solid var(--lineStrong);border-radius:14px;color:var(--text2)}
  .search .ph{flex:1;font-size:16px;color:var(--text3);letter-spacing:-.1px}
  .search .clear{width:22px;height:22px;border-radius:999px;background:var(--bg3);display:grid;place-items:center;color:var(--text2)}
  .search .go{width:30px;height:30px;border-radius:999px;background:var(--accent);color:var(--accentOn);display:grid;place-items:center}

  .pills{gap:8px;flex-wrap:wrap}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-family:inherit;font-size:11.5px;font-weight:500;
    border:.5px solid var(--lineStrong);background:transparent;color:var(--text2);min-height:26px;cursor:default}
  .pill.on{border:1px solid var(--accent);background:var(--accentTintStrong);color:var(--accent)}
  .pdot{width:6px;height:6px;border-radius:999px;background:var(--accent)}
  .dur{padding:9px 14px;border-radius:999px;font-family:inherit;font-size:13.5px;font-weight:500;border:.5px solid var(--lineStrong);background:var(--bg1);color:var(--text2);cursor:default}
  .dur.on{border:1px solid var(--accent);background:var(--accentTintStrong);color:var(--accent);font-weight:600}

  .card{background:var(--bg1);border:.5px solid var(--line);border-radius:14px;padding:14px 14px 13px 16px;box-shadow:0 1px 2px rgba(20,30,60,.10)}
  .card.active{border:1.5px solid var(--accent);box-shadow:0 10px 24px rgba(20,30,60,.22)}
  .top{align-items:flex-start;gap:12px}
  .meta{gap:6px;flex-wrap:wrap;margin-bottom:4px}
  .rank{font-size:10px;font-weight:500;letter-spacing:.4px;color:var(--text3)}
  .rank.hot{color:var(--accent)}
  .badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:500;letter-spacing:.6px;padding:2px 6px;border-radius:4px;
    background:var(--bg3);color:var(--text2);border:.5px solid var(--lineStrong);line-height:1}
  .badge.ev{background:var(--accentTint);color:var(--accent);border-color:var(--accent)}
  .badge.stale{background:var(--warnBg);color:var(--warn);border-color:var(--warn);text-transform:uppercase;font-size:9.5px;font-weight:600}
  .badge.cheapest{background:var(--accent);color:var(--accentOn);border-color:var(--accent);text-transform:uppercase;font-size:9.5px;font-weight:600}
  .name{font-size:17px;font-weight:600;line-height:1.15;letter-spacing:-.1px;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .block{font-size:12px;color:var(--text3);margin-top:2px}
  .cost{font-size:28px;font-weight:600;line-height:1;letter-spacing:-.6px;color:var(--text1)}
  .cost-cap{font-size:10.5px;letter-spacing:.2px;text-transform:uppercase;color:var(--text3);margin-top:4px}
  .cost-cap.warnish{color:var(--warn)}
  .rule{height:.5px;background:var(--line);margin:12px -16px 10px}
  .bottom{justify-content:space-between;gap:8px}
  .walk{gap:6px;color:var(--text2);font-size:12.5px}
  .walk .dim{color:var(--text3)}
  .lots{gap:6px}
  .dot{width:8px;height:8px;border-radius:999px;display:inline-block}
  .dot.ok{background:var(--ok)}
  .dot.warn{background:var(--warn);box-shadow:0 0 0 4px var(--warnBg);animation:pulse 1.6s ease-in-out infinite}
  .dot.bad{background:var(--bad)}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.85)}}
  .lots-label{font-size:12.5px;font-weight:500;color:var(--text1)}
  .lots-label.warn{color:var(--warn)}.lots-label.bad{color:var(--bad)}

  .toast{display:flex;align-items:center;gap:12px;background:var(--bg1);border:.5px solid var(--lineStrong);border-radius:14px;padding:12px 14px;
    box-shadow:0 10px 24px rgba(20,30,60,.22)}
  .ttile{width:30px;height:30px;border-radius:8px;background:var(--accentTintStrong);color:var(--accent);display:grid;place-items:center;flex:none}
  .toast b{display:block;font-size:13.5px;font-weight:600;color:var(--text1)}
  .toast span{display:block;font-size:12px;color:var(--text3)}

  .cta{display:flex;align-items:center;justify-content:center;gap:8px;padding:15px 18px;border:0;border-radius:14px;
    background:var(--accent);color:var(--accentOn);font-family:inherit;font-size:13.5px;font-weight:600;cursor:default}

  .sheet{background:var(--bg0);border:.5px solid var(--line);border-radius:22px 22px 0 0;padding:10px 0 18px;text-align:center}
  .handle{display:inline-block;width:38px;height:4px;border-radius:999px;background:var(--lineStrong)}
  .sheet-body{margin-top:10px;font-size:12.5px;color:var(--text3)}

  .tr{display:grid;grid-template-columns:110px 1fr 70px;align-items:baseline;gap:14px;padding:7px 0;border-bottom:.5px solid rgba(255,255,255,.07)}
  .tr code{font-size:11px;color:#8ea0b8}
  .tr small{font-size:10.5px;color:#7c869a}
  .ladder{background:#171a20;border-radius:14px;padding:6px 18px 14px;margin-top:22px;color:#e8ecf2}
  .ladder h3,.icons h3{font-size:13px;font-weight:600;margin:16px 0 8px;color:#c6d0dd}
  .icons{background:#171a20;border-radius:14px;padding:6px 18px 20px;margin-top:16px}
  .icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
  .icon-cell{border:.5px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 4px;text-align:center;color:#d5dce6}
  .icon-cell figcaption{margin-top:5px;font-size:9px;color:#8390a3;word-break:break-all}
  @media (prefers-reduced-motion:reduce){.dot.warn{animation:none}}
</style></head>
<body><div class="page">
  <div class="lede">
    <h1>wheretopark.sg — design system</h1>
    <p>Rendered entirely from <code>tokens.json</code> and the generated Android icon set, so this page
       checks the export rather than illustrating it. Sunlight is the default theme.</p>
  </div>

  <div class="themes">
    ${Object.entries(T.themes).map(([id, t]) => panel(id, t)).join('')}
  </div>

  <div class="ladder">
    <h3>Type ladder — Plus Jakarta Sans, tabular figures</h3>
    ${typeLadder}
  </div>

  <div class="icons">
    <h3>Icons — ${iconNames.length} VectorDrawables, 24dp / 1.75 stroke</h3>
    <div class="icon-grid">
      ${iconNames.map((n) => `<figure class="icon-cell" style="margin:0">${icon(n, 22)}<figcaption>${n.replace('ic_', '')}</figcaption></figure>`).join('')}
    </div>
  </div>
</div></body></html>
`;

writeFileSync(join(ROOT, 'preview.html'), html, 'utf8');
console.log(`preview.html written — ${Object.keys(T.themes).length} themes, ${iconNames.length} icons`);
