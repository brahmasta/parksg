# iOS launch promo video

`wheretopark-ios-promo.mp4`: 1080 × 1920, 30 fps, 15 s, no audio. For Threads,
Instagram Reels and Stories. Intro → four app scenes (results, map, carpark
detail, Plan your stay) → App Store badge end card.

## Re-render

`source/promo.html` draws frame `t` with `window.render(t)`; `source/render.mjs`
steps through it in headless Chrome. From a scratch folder holding the two
files plus the screenshots (`../screenshots/1-results-list.jpg`,
`2-results-map.jpg`, `3-detail.jpg`, `5-plan-stay.jpg`),
`public/app-store-badge-white.svg` and the Space Grotesk 500/600/700 `.woff2`
files from `node_modules/@fontsource/space-grotesk/files/`:

```bash
npm i puppeteer-core && node render.mjs
ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart wheretopark-ios-promo.mp4
```

`node render.mjs 9.5` renders one preview still at 9.5 s.
