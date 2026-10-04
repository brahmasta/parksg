#!/usr/bin/env bash
# Render the icon layers from resources/icon.html with a headless Chromium
# (Edge on Windows/Git Bash, Chrome or Edge on macOS), then run
# `npx capacitor-assets generate` to rebuild the Android and iOS launcher
# icons and splash screens.
set -e
cd "$(dirname "$0")"
if command -v cygpath >/dev/null; then
  BROWSER="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  winpath() { cygpath -w "$1"; }
  fileurl() { echo "file:///$(cygpath -m "$1")"; }
else
  for b in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    [ -x "$b" ] && BROWSER="$b" && break
  done
  [ -n "$BROWSER" ] || { echo "Install Google Chrome or Microsoft Edge" >&2; exit 1; }
  winpath() { echo "$1"; }
  fileurl() { echo "file://$1"; }
fi
for layer in full fg bg tile; do
  "$BROWSER" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --virtual-time-budget=8000 --window-size=1024,1024 \
    --screenshot="$(winpath "$PWD/layer-$layer.png")" \
    "$(fileurl "$PWD/icon.html")?layer=$layer" 2>/dev/null
done

# Compose the @capacitor/assets sources and the Play Store icon.
cd ..
node -e "
const sharp = require('sharp');
const r = (f) => 'resources/' + f;
(async () => {
  await sharp(r('layer-full.png')).png().toFile(r('icon-only.png'));
  await sharp(r('layer-fg.png')).png().toFile(r('icon-foreground.png'));
  await sharp(r('layer-bg.png')).png().toFile(r('icon-background.png'));
  await sharp(r('layer-full.png')).resize(512, 512).png().toFile('store/icon-512.png');
  const tile = await sharp(r('layer-tile.png')).resize(900, 900).png().toBuffer();
  for (const [name, bg] of [['splash.png', '#fafafa'], ['splash-dark.png', '#12151a']]) {
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
      .composite([{ input: tile, gravity: 'center' }]).png().toFile(r(name));
  }
})();"
rm -f resources/layer-*.png
npx capacitor-assets generate --android --ios \
  --iconBackgroundColor '#2ee3c2' --iconBackgroundColorDark '#2ee3c2' \
  --splashBackgroundColor '#fafafa' --splashBackgroundColorDark '#12151a'
