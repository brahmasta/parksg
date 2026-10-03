# Google Play listing assets

- `icon-512.png`: hi-res icon (from `resources/icon-only.png`).
- `feature-graphic.png`: 1024x500 feature graphic, rendered from `feature-graphic.html`:

  ```bash
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --hide-scrollbars --virtual-time-budget=8000 --window-size=1024,500 --screenshot="$(cygpath -w "$PWD/store/feature-graphic.png")" "file:///$(cygpath -m "$PWD/store/feature-graphic.html")"
  ```
- `screenshots/`: phone screenshots, 1344x2688 (status and gesture bars cropped so
  the ratio stays within Play's 2:1 limit). Check each one for notifications and
  personal data (account initials, saved places, recents) before uploading.
