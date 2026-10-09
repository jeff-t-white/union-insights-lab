import { geoMercator } from 'd3';
import { useEffect, useId, useRef, useState } from 'react';
import { CAMPUS_CENTER, DINING_SOURCE, TILE_URL } from './mapConfig';
import './campus-map.css';

const HEIGHT = 500;
const TILE_SIZE = 256;

export function CampusMap() {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const [width, setWidth] = useState(0);
  const [center, setCenter] = useState<[number, number]>(CAMPUS_CENTER);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [tileError, setTileError] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  const zoom = Math.max(12, Math.min(18, (width >= 700 ? 14 : 13) + zoomOffset));
  const worldSize = TILE_SIZE * 2 ** zoom;
  // The tile grid and future dining markers share this Mercator projection.
  const worldProjection = geoMercator().scale(worldSize / (2 * Math.PI)).translate([worldSize / 2, worldSize / 2]);
  const worldCenter = worldProjection(center)!;
  const left = worldCenter[0] - width / 2;
  const top = worldCenter[1] - HEIGHT / 2;
  const projection = geoMercator().scale(worldSize / (2 * Math.PI)).center(center).translate([width / 2, HEIGHT / 2]);
  const tiles = [];
  if (width > 0) {
    for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + width) / TILE_SIZE); x++) {
      for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + HEIGHT) / TILE_SIZE); y++) {
        if (x < 0 || y < 0 || x >= 2 ** zoom || y >= 2 ** zoom) continue;
        tiles.push({ x, y, url: TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)) });
      }
    }
  }

  function pan(dx: number, dy: number) {
    const next = projection.invert?.([width / 2 + dx, HEIGHT / 2 + dy]);
    if (next) setCenter(next);
  }

  function reset() {
    setCenter(CAMPUS_CENTER);
    setZoomOffset(0);
    setTileError(false);
  }

  return (
    <div className="campus-example">
      <div className="map-toolbar">
        <div><strong>UW–Madison campus</strong><span>Madison, Wisconsin · Basemap</span></div>
        <button type="button" onClick={reset}>Reset campus view</button>
      </div>
      <div className="map-frame" ref={container}>
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${width || 1} ${HEIGHT}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>Street map of the UW–Madison campus</title>
          <desc id={descriptionId}>Campus and surrounding streets along the south shore of Lake Mendota. Dining markers have not yet been added. Use the adjacent buttons to zoom and pan.</desc>
          {tiles.map((tile) => <image key={`${zoom}/${tile.x}/${tile.y}`} href={tile.url} x={tile.x * TILE_SIZE - left} y={tile.y * TILE_SIZE - top} width={TILE_SIZE} height={TILE_SIZE} onError={() => setTileError(true)} />)}
          {/* Future dining markers go here, using projection(location.coordinates). */}
        </svg>
        <div className="map-drag-surface" aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, center };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const start = worldProjection(drag.current.center)!;
            const next = worldProjection.invert?.([start[0] - (event.clientX - drag.current.x), start[1] - (event.clientY - drag.current.y)]);
            if (next) setCenter(next);
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
        />
        <div className="map-controls" role="group" aria-label="Map controls">
          <button type="button" aria-label="Zoom in" disabled={zoom === 18} onClick={() => setZoomOffset((value) => value + 1)}>+</button>
          <button type="button" aria-label="Zoom out" disabled={zoom === 12} onClick={() => setZoomOffset((value) => value - 1)}>−</button>
          <span className="control-divider" />
          <button type="button" aria-label="Pan north" onClick={() => pan(0, -150)}>↑</button>
          <button type="button" aria-label="Pan west" onClick={() => pan(-150, 0)}>←</button>
          <button type="button" aria-label="Pan east" onClick={() => pan(150, 0)}>→</button>
          <button type="button" aria-label="Pan south" onClick={() => pan(0, 150)}>↓</button>
        </div>
        <span className="map-north" aria-hidden="true">↑ N</span>
        <div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></div>
      </div>
      {tileError && <p className="map-error" role="status">Some map tiles couldn’t load. Check your internet connection, then reset the view or reload the page.</p>}
      <p className="map-instructions">Drag to explore, or use the arrow buttons to move the map. Use + and − to zoom.</p>
      <div className="map-notes"><div><p className="eyebrow">First exploration</p><h2>The campus, before the pins.</h2><p>This street map is the starting point for exploring Wisconsin Union dining across campus. Dining locations will be added as a separate layer once their coordinates are verified.</p></div><div><p className="eyebrow">Sources & scope</p><p>Basemap: <a href="https://www.openstreetmap.org/">OpenStreetMap</a>. Map tiles load over the internet. This is a campus-area view, not an official campus boundary.</p><p>Next layer: <a href={DINING_SOURCE}>Wisconsin Union’s food & drink directory ↗</a></p><a className="map-issue" href="https://www.openstreetmap.org/fixthemap">Report a basemap issue ↗</a></div></div>
    </div>
  );
}
