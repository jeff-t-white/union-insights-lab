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

Open the first card on the home page, or visit `/#/examples/campus-map` on the local dev server. Drag to pan with inertia, double-click to zoom in (Shift + double-click zooms out), hold Ctrl/⌘ and scroll to zoom around the cursor, use the +/− buttons, or reset to the initial campus view. On touchscreens use two fingers to pan or pinch to zoom. Focus the map to use arrow keys and +/−. Native controls provide fullscreen (including dining filters) and Locate me; location permission is requested only when that control is clicked. Rotation, pitch, and the north marker are disabled. Ordinary scrolling still scrolls the page. Buttons also support keyboard navigation.

`CampusMap.tsx` keeps the view and dining interactions in React; D3 projects the building paths and dining markers. `QuietBasemap.tsx` renders an OpenFreeMap Positron background with MapLibre, retaining street and water labels while removing unrelated symbols and labels. Buildings use subtle provider shading, with stronger shading on hover or keyboard focus. No API key is needed; the background requires internet access and WebGL. OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution remains visible. The text directory still works when the background cannot load.

`ResizeObserver` measures the container. MapLibre now owns camera movement and native gesture handling; React receives the camera actually drawn on each render frame so D3 overlays follow native animations and inertia. MapLibre's 512px world uses one less zoom level than our 256px D3 world. React portals put the footprints and markers in the native canvas event container so dragging and double-clicking also work over overlays, while popup panels sit outside the gesture surface. Cooperative gestures retain Ctrl/⌘-scroll and protect page scrolling; native fullscreen temporarily allows unrestricted wheel/touch navigation. Native zoom, fullscreen, and geolocation controls follow the [UW dining map](https://www.wisc.edu/dining/) approach without borrowing its Mapbox credentials. The worker URL uses Vite's production base for GitHub Pages. Run `node scripts/check-map-fit.mjs` to check desktop/mobile fit and the shared Mercator coordinate calculation. Basemap reference: [OpenFreeMap quick start](https://openfreemap.org/quick_start/).

`src/examples/campus-map/mapConfig.ts` holds the reference campus center and official dining-directory link. `dining-buildings.json` contains 17 OSM footprints and 36 directory entries grouped by building, checked October 9, 2026. Hover, keyboard-focus, or tap a highlighted building to see its outlets and street address; the expandable building list provides the same information and can center the map on a building. Seasonal Terrace listings are grouped with Memorial Union. The footprint identifies the host building, not the exact dining counter; the popup links to current Union hours and menus rather than storing a stale open/closed status.

To refresh geometry, run `node scripts/fetch-campus-data.mjs` (internet required), then `node scripts/prepare-dining-buildings.mjs`. The latter explicitly matches OSM building names and validates closed rings before saving the small selected dataset. Review outlet/building mappings in that script against the official directory when refreshing. The full OSM download is ignored by Git. Data is © OpenStreetMap contributors under ODbL; attribution appears on the map. The building layer uses projected SVG paths with an even-odd fill for interior rings, while the original basemap labels remain visible. Memorial Union has a documented local correction from Union staff: its inner cutout is omitted, retaining the exterior outline without implying a courtyard. The Terrace remains outdoor space north of the building, between the building and Lake Mendota. This correction is applied in the preparation script so refreshing data preserves it; it does not edit OpenStreetMap itself.

## Published UW dining coordinates

The map displays 51 dining markers: 34 Wisconsin Union, 11 University Housing, and 6 Other Dining Options. These combine 48 locations from the [UW–Madison dining map](https://www.wisc.edu/dining/) with staff-provided coordinates for Veterinary Medicine, Pedone Pinsa, and Hosto. Wisconsin Union Catering is excluded from both markers and dining highlights. Independent checkbox filters control markers, the text directory, and building highlights. Marker colors and shapes distinguish providers; hover, keyboard focus, or tap reveals location information. Initial and reset views fit the active providers to the available map space.

Babcock Hall Dairy Store is included under Other Dining Options. Pasta Pronto is permanently discontinued and excluded. Classification uses the location-information domain; Fluno Center dining is assigned to Wisconsin Union. Published names remain in the point export, while the application uses the reviewed mobile-ordering names and logos for matched Union outlets. Union Catering remains in the unchanged reference exports but is excluded from the application; Sett Rec remains a source record.

`src/examples/campus-map/uw-dining-coordinates.csv` provides names, providers, latitude, longitude, and source links for Excel. `uw-dining-points.geojson` supplies the same data in **[longitude, latitude]** order; `campus-dining-points.json` is the raw marker snapshot used by the preparation script. Precision is preserved as published, but these are authored map markers, not surveyed counter positions. Locations absent from the source (including Naan Stop Express and the Terrace Pop-Up Store) remain in the Union building listings without invented point coordinates.

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

`node scripts/prepare-campus-dining.mjs` joins the published markers with the reviewed Union directory and named OSM footprints. Run it after refreshing either dining dataset (and after preparing Union buildings). The resulting `campus-dining.json` supplies 26 buildings and 51 markers to the UI. Host buildings are explicitly matched, not inferred from nearest points. Nine additional footprints cover Housing and Other dining. Catering is excluded from the display; buildings with no remaining dining outlets are omitted from dining shading.

Marker names, logos, and ordering links use the existing mobile-enriched Union building outlet when a match exists. Original published names and coordinates remain in the reference exports and in each matched marker's `sourceName`. Building popups, the building directory, marker popups, and the point directory use those same display names. Housing and Other locations retain their published names. Each provider filter controls both its outlets and shading; Discovery is shared by Union and Other dining, shown in purple while both providers are enabled, and in the remaining provider's color when only one is enabled. Building popups link each outlet to its own hours/location page.

Host-building references: [Housing dining guide](https://media.housing.wisc.edu/documents/dining/2025-dining-guide.pdf), [Shake Smart at Bakke](https://www.housing.wisc.edu/dining/locations/shake-smart/), and [Discovery Building facilities](https://wid.wisc.edu/facilities/). Geometry remains © OpenStreetMap contributors.

### Building labels and Medical Sciences correction

`node scripts/prepare-building-labels.mjs` creates the building-name label snapshot from the named OSM download and the corrected dining footprints. Run it after preparing campus dining data. QuietBasemap adds these as a collision-managed text layer at campus zoom levels; unrelated business, parking, and transit symbols remain hidden. Dining building names take precedence in this layer.

The Medical Sciences market uses the main Medical Sciences Center footprint, [OSM relation 19566386](https://www.openstreetmap.org/relation/19566386), at 1300 University Avenue. The earlier name match selected the separate small Linden Drive wing. `medical-sciences-footprint.json` preserves the verified main-building geometry, including its two interior rings, and the preparation script selects it explicitly. The published market coordinates remain unchanged. Its address is confirmed by the [Union location page](https://union.wisc.edu/dine/find-food-and-drink/badger-market-in-medical-sciences).

The Veterinary Medicine point is stored in `additional-dining-points.json` as **[longitude, latitude]**: `[-89.42115720260753, 43.07573027983368]`. These coordinates were provided by Union staff on October 9, 2026, rather than extracted from the UW dining map. The preparation script merges this supplemental point with the published markers and connects it to the existing Veterinary Medicine North building, mobile-ordering name, logo, and ordering link. Refreshing the published UW data preserves the supplemental coordinates; the CSV and GeoJSON reference exports remain faithful to that published source.

`additional-dining-points.json` also includes staff-provided coordinates for Pedone Pinsa (`[-89.40862981444856, 43.072935570998034]`) and Hosto (`[-89.40166166766582, 43.071962619479805]`). These join the existing Discovery and Levy Hall listings, using their reviewed mobile-ordering names, logos, and links. Exclusions in the preparation script prevent Union Catering from returning after a source refresh; Grainger Hall has no dining highlight in the application.
