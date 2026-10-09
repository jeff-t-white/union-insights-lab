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

Open the first card on the home page, or visit `/#/examples/campus-map` on the local dev server. Drag to pan, use the zoom/arrow buttons, or reset to the initial campus view. Buttons also support keyboard navigation.

`src/examples/campus-map/CampusMap.tsx` renders visible OpenStreetMap tiles using React. D3's Mercator projection places the tiles and will position future markers in the same coordinate system. `ResizeObserver` measures the container, and React owns the view state. No API key is needed; an internet connection is required for tiles. Tile use follows the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/), with visible attribution and ordinary browser caching; no offline downloading or prefetching is included.

`src/examples/campus-map/mapConfig.ts` holds the view center, tile provider, official dining-directory link, and a typed, currently empty dining dataset. Add verified dining locations here using **[longitude, latitude]**, not the reverse. The next step is to verify building addresses/coordinates from the Wisconsin Union directory, accounting for multiple outlets in the same building, then render their markers. The current map has no dining pins or official campus boundary.

## Visualization conventions

Follow [Yan Holtz’s React Graph Gallery approach](https://www.react-graph-gallery.com/about): **D3 calculates; React renders.** Use D3 for scales, layouts, projections, and paths; render SVG elements in JSX. Avoid D3 selections modifying React-owned DOM. Import only the D3 utilities the example uses.

Keep data preparation separate from drawing, and give chart components explicit typed data and dimension props. When adding a responsive chart, measure its container with `ResizeObserver`, and pass the resulting dimensions to the drawing component. Keep interaction state in React. Include a meaningful chart title, description, readable labels, source/date notes, and a text or table alternative; do not convey meaning through color alone.

The visual scaffold uses [UW–Madison’s digital color palette](https://brand.wisc.edu/visual-identity/colors/) with Badger Red (`#C5050C`), dark red, black, white, and light gray. The typographic wordmark is project text, not an official university logo. Fonts load from Google Fonts with local fallbacks.

## Work information

Only commit information approved for the repository’s audience. Frontend files and bundled data are visible to anyone who can access a deployed site. Keep private datasets and credentials out of Git; `.env` files are ignored, but client-side environment values are still public in builds.

## Deployment

This scaffold is local and has not been published. Deploy `dist/` to a static host when ready. Vite uses relative asset paths so the build can also live under a repository subpath.
