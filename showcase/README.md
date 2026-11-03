# wheretopark.sg showcase kit (Manfaat Labs)

Hand-off for the builder of the Manfaat Labs landing page.

- `index.html`: the kit page (published as an Artifact): copy, facts, brand, assets.
- `copy.md`: all copy as plain text.
- `assets/`: images and logos. Screenshots contain public carpark data only.
- `card.html`: source of `assets/showcase-card-1600x1000.png`. Re-render with:

  ```bash
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --hide-scrollbars --user-data-dir="$(cygpath -w "$TEMP/edge-shot")" --virtual-time-budget=8000 --window-size=1600,1000 --screenshot="$(cygpath -w "$PWD/showcase/assets/showcase-card-1600x1000.png")" "file:///$(cygpath -m "$PWD/showcase/card.html")"
  ```
- Wordmark SVGs are outlined from Space Grotesk (see the commit that added them).

Figures are as of 8 October 2026 (live database counts).
