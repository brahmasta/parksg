// Renders promo.html frame by frame (FPS) to frames/%04d.png.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FPS = 30;
const only = process.argv[2]; // optional: a single time in seconds, for previews
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--allow-file-access-from-files', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(new URL('./promo.html', import.meta.url).pathname).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
mkdirSync(new URL('./frames/', import.meta.url).pathname, { recursive: true });

const times = only != null
  ? [Number(only)]
  : Array.from({ length: Math.ceil(duration * FPS) }, (_, i) => i / FPS);
for (const [i, t] of times.entries()) {
  await page.evaluate((x) => window.render(x), t);
  const name = only != null ? `preview-${only}.png` : `frames/${String(i).padStart(4, '0')}.png`;
  await page.screenshot({ path: new URL(`./${name}`, import.meta.url).pathname, type: 'png' });
}
console.log(`duration ${duration.toFixed(2)}s, rendered ${times.length} frame(s)`);
await browser.close();
