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

Open the first card on the home page, or visit `/#/examples/campus-map` on the local dev server. Drag to pan, hold Ctrl and scroll to zoom around the cursor, use the +/− buttons, or reset to the initial campus view. Ordinary scrolling still scrolls the page. Buttons also support keyboard navigation.

`src/examples/campus-map/CampusMap.tsx` renders visible OpenStreetMap tiles using React. D3's Mercator projection places the tiles and positions dining markers in the same coordinate system. `ResizeObserver` measures the container, and React owns the view state. No API key is needed; an internet connection is required for tiles. Tile use follows the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/), with visible attribution and ordinary browser caching; no offline downloading or prefetching is included.

`src/examples/campus-map/mapConfig.ts` holds the view center, tile provider, and official dining-directory link. `dining-buildings.json` contains 17 OSM footprints and 36 directory entries grouped by building, checked October 9, 2026. Hover, keyboard-focus, or tap a highlighted building to see its outlets and street address; the expandable building list provides the same information and can center the map on a building. Seasonal Terrace listings are grouped with Memorial Union. The footprint identifies the host building, not the exact dining counter; the popup links to current Union hours and menus rather than storing a stale open/closed status.

To refresh geometry, run `node scripts/fetch-campus-data.mjs` (internet required), then `node scripts/prepare-dining-buildings.mjs`. The latter explicitly matches OSM building names and validates closed rings before saving the small selected dataset. Review outlet/building mappings in that script against the official directory when refreshing. The full OSM download is ignored by Git. Data is © OpenStreetMap contributors under ODbL; attribution appears on the map. The building layer uses projected SVG paths with an even-odd fill for interior rings, while the original basemap labels remain visible. Memorial Union has a documented local correction from Union staff: its inner cutout is omitted, retaining the exterior outline without implying a courtyard. The Terrace remains outdoor space north of the building, between the building and Lake Mendota. This correction is applied in the preparation script so refreshing data preserves it; it does not edit OpenStreetMap itself.

## Published UW dining coordinates

The map displays all 49 published points from the [UW–Madison dining map](https://www.wisc.edu/dining/): 32 Wisconsin Union, 11 University Housing, and 6 Other Dining Options. Independent checkbox filters control markers, the text directory, and Union building highlights. Marker colors and shapes distinguish providers; hover, keyboard focus, or tap reveals a location-information link. The initial and reset views fit the active providers to the available map space.

Babcock Hall Dairy Store is included under Other Dining Options. Pasta Pronto is permanently discontinued and excluded. Classification uses the location-information domain; Fluno Center dining is assigned to Wisconsin Union. Published names remain in the point export, while the application uses the reviewed mobile-ordering names and logos for matched Union outlets. Union Catering and Sett Rec remain source records rather than being represented as new restaurants.

`src/examples/campus-map/uw-dining-coordinates.csv` provides names, providers, latitude, longitude, and source links for Excel. `uw-dining-points.geojson` supplies the same data in **[longitude, latitude]** order; `campus-dining-points.json` is the raw marker snapshot used by the preparation script. Precision is preserved as published, but these are authored map markers, not surveyed counter positions. Locations absent from the source (including Hosto, Pedone Pinsa, Veterinary Medicine, Naan Stop Express, and the Terrace Pop-Up Store) remain in the Union building listings without invented point coordinates.

Refresh with `node scripts/extract-uw-dining-coordinates.mjs` (internet required), or pass saved source HTML as its argument. The script reads literal feature fields without executing source-page JavaScript and validates coordinate ranges before writing exports. Review provider assignments and source changes when refreshing.

## Mobile-ordering names and logos

The map uses a reviewed snapshot of [UW–Madison mobile ordering](https://weborder.transactcampus.com/230) for 21 Union outlet names, logos, and direct ordering links. The broader Union dining directory supplies the remaining outlets; absence from mobile ordering does not remove a location. Pasta Pronto is excluded as permanently closed, and Babcock Dairy Store is excluded from this Union-only ordering snapshot because it is not operated by the Union (user-provided corrections). No live opening status or wait times are copied.

The snapshot is `src/examples/campus-map/mobile-ordering.json`; each logo is stored under `public/dining-logos/`, with its original URL recorded in the snapshot. Logos remain the property of their respective owners. Paths use Vite's deployment base so they work locally and on GitHub Pages. Veterinary Medicine's market is mapped to the North building at 515 Easterday Lane, matching both the ordering platform and the [Union listing](https://union.wisc.edu/dine/find-food-and-drink/vetmed).

To refresh, capture the rendered public ordering directory HTML (the initial page source is only a JavaScript shell), then run `node scripts/import-ordering-directory.mjs <rendered-directory.html>` followed by `node scripts/prepare-dining-buildings.mjs`. The importer requires an explicit building mapping for every included ordering location and validates downloaded logo file signatures. Review new, moved, renamed, or removed listings before changing those mappings. Never supply an account page, order history, or a customer-data export.

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

### Provider shading and consistent display names

`node scripts/prepare-campus-dining.mjs` joins the published markers with the reviewed Union directory and named OSM footprints. Run it after refreshing either dining dataset (and after preparing Union buildings). The resulting `campus-dining.json` supplies 26 buildings and 49 markers to the UI. Host buildings are explicitly matched, not inferred from nearest points. Nine additional footprints cover Housing and Other dining. Catering retains its source point without a guessed host building.

Marker names, logos, and ordering links use the existing mobile-enriched Union building outlet when a match exists. Original published names and coordinates remain in the reference exports and in each matched marker's `sourceName`. Building popups, the building directory, marker popups, and the point directory use those same display names. Housing and Other locations retain their published names. Each provider filter controls both its outlets and shading; Discovery is shared by Union and Other dining, shown in purple while both providers are enabled, and in the remaining provider's color when only one is enabled. Building popups link each outlet to its own hours/location page.

Host-building references: [Housing dining guide](https://media.housing.wisc.edu/documents/dining/2025-dining-guide.pdf), [Shake Smart at Bakke](https://www.housing.wisc.edu/dining/locations/shake-smart/), and [Discovery Building facilities](https://wid.wisc.edu/facilities/). Geometry remains © OpenStreetMap contributors.
