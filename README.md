# Union Insights Lab

A React + D3 learning collection for work at the Wisconsin Union, UW–Madison. The first example is an interactive campus basemap. No dummy projects or private work data are included.

## Run locally

Requires Node.js 22.12+ (or a newer supported LTS release).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` checks TypeScript and builds the static site into `dist/`. `npm run preview` serves that build; `npm run typecheck` checks types separately.

## Add a visualization

1. Create a folder in `src/examples/` for the example, keeping its React page, visualization component, data transformations, and source notes together.
2. Export a page component, then add its `slug`, `title`, `description`, `category`, and `component` to the `examples` array in `src/examples/index.ts`.
3. The home page will show the entry automatically. Its address is `#/examples/your-slug`; hash navigation works on static hosts without rewrite rules.

## Campus map

Open the first card on the home page, or visit `/#/examples/campus-map` on the local dev server. Drag to pan, hold Ctrl and scroll to zoom around the cursor, use the zoom/arrow buttons, or reset to the initial campus view. Ordinary scrolling still scrolls the page. Buttons also support keyboard navigation.

`src/examples/campus-map/CampusMap.tsx` renders visible OpenStreetMap tiles using React. D3's Mercator projection places the tiles and will position future markers in the same coordinate system. `ResizeObserver` measures the container, and React owns the view state. No API key is needed; an internet connection is required for tiles. Tile use follows the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/), with visible attribution and ordinary browser caching; no offline downloading or prefetching is included.

`src/examples/campus-map/mapConfig.ts` holds the view center, tile provider, and official dining-directory link. `dining-buildings.json` contains 17 OSM footprints and 36 directory entries grouped by building, checked October 9, 2026. Hover, keyboard-focus, or tap a highlighted building to see its outlets and street address; the expandable building list provides the same information and can center the map on a building. Seasonal Terrace listings are grouped with Memorial Union. The footprint identifies the host building, not the exact dining counter; the popup links to current Union hours and menus rather than storing a stale open/closed status.

To refresh geometry, run `node scripts/fetch-campus-data.mjs` (internet required), then `node scripts/prepare-dining-buildings.mjs`. The latter explicitly matches OSM building names and validates closed rings before saving the small selected dataset. Review outlet/building mappings in that script against the official directory when refreshing. The full OSM download is ignored by Git. Data is © OpenStreetMap contributors under ODbL; attribution appears on the map. The building layer uses projected SVG paths with an even-odd fill to preserve courtyard holes, while the original basemap labels remain visible.

## Visualization conventions

Follow [Yan Holtz’s React Graph Gallery approach](https://www.react-graph-gallery.com/about): **D3 calculates; React renders.** Use D3 for scales, layouts, projections, and paths; render SVG elements in JSX. Avoid D3 selections modifying React-owned DOM. Import only the D3 utilities the example uses.

Keep data preparation separate from drawing, and give chart components explicit typed data and dimension props. When adding a responsive chart, measure its container with `ResizeObserver`, and pass the resulting dimensions to the drawing component. Keep interaction state in React. Include a meaningful chart title, description, readable labels, source/date notes, and a text or table alternative; do not convey meaning through color alone.

The visual scaffold uses [UW–Madison’s digital color palette](https://brand.wisc.edu/visual-identity/colors/) with Badger Red (`#C5050C`), dark red, black, white, and light gray. The typographic wordmark is project text, not an official university logo. Fonts load from Google Fonts with local fallbacks.

## Work information

Only commit information approved for the repository’s audience. Frontend files and bundled data are visible to anyone who can access a deployed site. Keep private datasets and credentials out of Git; `.env` files are ignored, but client-side environment values are still public in builds.

## Deployment

The GitHub Pages deployment is defined in `.github/workflows/deploy.yml`. It installs dependencies, checks TypeScript, builds the site, and publishes only the browser-ready `dist/` folder whenever you push to `main`.

One-time setup on GitHub:

1. Open the repository's **Settings → Pages**.
2. Change **Source** from **Deploy from a branch** to **GitHub Actions**.
3. Commit and push the deployment workflow and Vite configuration changes.
4. Watch **Actions → Deploy website to GitHub Pages** for a successful run, then open https://jeff-t-white.github.io/union-insights-lab/.

If the files were pushed before changing the Pages source, open that workflow under **Actions**, choose **Run workflow**, and run it on `main`.

Publishing directly from the repository root does not build the React/TypeScript source; it can report a successful deployment while showing a blank page. The workflow supplies the missing build step. Vite's production asset base is `/union-insights-lab/`, while local development stays at `/`. If the repository name or hosting path changes, update `vite.config.ts` accordingly. You do not need to commit `dist/`.
