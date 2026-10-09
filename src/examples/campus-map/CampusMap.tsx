import { geoMercator } from 'd3';
import { useEffect, useId, useRef, useState } from 'react';
import { CAMPUS_CENTER, DINING_SOURCE, TILE_URL } from './mapConfig';
import './campus-map.css';
import diningData from './dining-buildings.json';

const TILE_SIZE = 256;

export function CampusMap() {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(500);
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [center, setCenter] = useState<[number, number]>(CAMPUS_CENTER);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showBuilding(id: string) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredId(id);
  }
  function leaveBuilding() {
    hoverTimer.current = setTimeout(() => setHoveredId(null), 180);
  }
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  const selected = diningData.buildings.find((building) => building.id === (hoveredId ?? selectedId));
  const wheelState = useRef({ delta: 0, lastTime: 0 });
  const zoomRef = useRef<(direction: number, x: number, y: number) => void>(() => {});
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
      setHeight(entry.contentRect.height);
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        expandButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!event.deltaY) return;
      const now = performance.now();
      const state = wheelState.current;
      if (now - state.lastTime > 180 || Math.sign(state.delta) !== Math.sign(event.deltaY)) state.delta = 0;
      state.delta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      if (Math.abs(state.delta) < 35 || now - state.lastTime < 160) return;
      const bounds = element.getBoundingClientRect();
      zoomRef.current(state.delta < 0 ? 1 : -1, event.clientX - bounds.left, event.clientY - bounds.top);
      state.delta = 0;
      state.lastTime = now;
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = Math.max(12, Math.min(18, (width >= 700 ? 14 : 13) + zoomOffset));
  const worldSize = TILE_SIZE * 2 ** zoom;
  // The tile grid and future dining markers share this Mercator projection.
  const worldProjection = geoMercator().scale(worldSize / (2 * Math.PI)).translate([worldSize / 2, worldSize / 2]);
  const worldCenter = worldProjection(center)!;
  const left = worldCenter[0] - width / 2;
  const top = worldCenter[1] - height / 2;
  const projection = geoMercator().scale(worldSize / (2 * Math.PI)).center(center).translate([width / 2, height / 2]);
  function changeZoom(direction: number, x = width / 2, y = height / 2) {
    const nextZoom = Math.max(12, Math.min(18, zoom + direction));
    if (nextZoom === zoom) return;
    // Keep the geographic point beneath the cursor fixed while zooming.
    const ratio = 2 ** (nextZoom - zoom);
    const nextCenter = worldProjection.invert?.([
      worldCenter[0] + (x - width / 2) * (1 - 1 / ratio),
      worldCenter[1] + (y - height / 2) * (1 - 1 / ratio),
    ]);
    if (nextCenter) setCenter(nextCenter);
    setZoomOffset(nextZoom - (width >= 700 ? 14 : 13));
  }
  useEffect(() => { zoomRef.current = changeZoom; });
  function footprintPath(rings: number[][][]) {
    return rings.map((ring) => ring.map((point, index) => {
      const [x, y] = projection([point[0], point[1]])!;
      return `${index ? 'L' : 'M'}${x},${y}`;
    }).join(' ') + 'Z').join(' ');
  }
  const tiles = [];
  if (width > 0) {
    for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + width) / TILE_SIZE); x++) {
      for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + height) / TILE_SIZE); y++) {
        if (x < 0 || y < 0 || x >= 2 ** zoom || y >= 2 ** zoom) continue;
        tiles.push({ x, y, url: TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)) });
      }
    }
  }

  function pan(dx: number, dy: number) {
    const next = projection.invert?.([width / 2 + dx, height / 2 + dy]);
    if (next) setCenter(next);
  }

  function reset() {
    setCenter(CAMPUS_CENTER);
    setZoomOffset(0);
    setTileError(false);
    setSelectedId(null);
    setHoveredId(null);
  }

  return (
    <div className="campus-example">
      <div className={`map-shell${expanded ? ' is-expanded' : ''}`}>
      <div className="map-toolbar">
        <div><strong>UW–Madison campus</strong><span>Red buildings · Wisconsin Union dining</span></div>
        <div className="map-toolbar-actions">
          <button type="button" onClick={reset}>Reset campus view</button>
          <button type="button" ref={expandButton} aria-pressed={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Exit full window' : 'Expand map'}</button>
        </div>
      </div>
      <div className="map-frame" ref={container}>
        <svg width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>Street map of the UW–Madison campus</title>
          <desc id={descriptionId}>Campus and surrounding streets along the south shore of Lake Mendota. Red footprints highlight buildings with Union dining. The building list below provides the same information.</desc>
          {tiles.map((tile) => <image key={`${zoom}/${tile.x}/${tile.y}`} href={tile.url} x={tile.x * TILE_SIZE - left} y={tile.y * TILE_SIZE - top} width={TILE_SIZE} height={TILE_SIZE} onError={() => setTileError(true)} />)}
        </svg>
        <div className="map-drag-surface" aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            setSelectedId(null);
            setHoveredId(null);
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
        <svg className="building-overlay" width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} aria-label="Dining building highlights">
          {diningData.buildings.map((building) => <path key={building.id} d={footprintPath(building.rings)} fillRule="evenodd" className={`dining-footprint${selected?.id === building.id ? ' is-active' : ''}`} tabIndex={0} role="button" aria-label={`${building.name}: ${building.outlets.join(', ')}`} aria-pressed={selectedId === building.id}
            onPointerEnter={() => showBuilding(building.id)} onPointerLeave={leaveBuilding}
            onFocus={() => showBuilding(building.id)} onBlur={leaveBuilding}
            onClick={() => setSelectedId((value) => value === building.id ? null : building.id)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId((value) => value === building.id ? null : building.id); } if (event.key === 'Escape') { setSelectedId(null); setHoveredId(null); } }}><title>{building.name}</title></path>)}
        </svg>
        {selected && <aside className="building-popup" aria-label="Dining building details" onPointerEnter={() => showBuilding(selected.id)} onPointerLeave={leaveBuilding}>
          <button className="popup-close" type="button" aria-label="Close building details" onClick={() => { setSelectedId(null); setHoveredId(null); }}>×</button>
          <h3>{selected.name}</h3><p>{selected.address}</p>
          <ul>{selected.outlets.map((outlet) => <li key={outlet}>{outlet}</li>)}</ul>
          <a href={DINING_SOURCE}>Current hours & menus ↗</a>
        </aside>}
        <div className="map-controls" role="group" aria-label="Map controls">
          <button type="button" aria-label="Zoom in" disabled={zoom === 18} onClick={() => changeZoom(1)}>+</button>
          <button type="button" aria-label="Zoom out" disabled={zoom === 12} onClick={() => changeZoom(-1)}>−</button>
          <span className="control-divider" />
          <button type="button" aria-label="Pan north" onClick={() => pan(0, -150)}>↑</button>
          <button type="button" aria-label="Pan west" onClick={() => pan(-150, 0)}>←</button>
          <button type="button" aria-label="Pan east" onClick={() => pan(150, 0)}>→</button>
          <button type="button" aria-label="Pan south" onClick={() => pan(0, 150)}>↓</button>
        </div>
        <span className="map-north" aria-hidden="true">↑ N</span>
        <div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></div>
      </div>
      </div>
      {tileError && <p className="map-error" role="status">Some map tiles couldn’t load. Check your internet connection, then reset the view or reload the page.</p>}
      <p className="map-instructions">Drag to explore. Hold Ctrl and scroll to zoom toward your cursor, or use + and −. Hover, focus, or tap a red building for dining details.</p>
      <details className="dining-list"><summary>Browse dining by building ({diningData.buildings.length} buildings)</summary><div>{diningData.buildings.map((building) => <section key={building.id}><button type="button" onClick={() => { const points = building.rings[0]; setCenter([points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length]); setZoomOffset(17 - (width >= 700 ? 14 : 13)); setSelectedId(building.id); setHoveredId(null); container.current?.scrollIntoView({ block: 'center' }); }}>{building.name} ↗</button><p>{building.address}</p><ul>{building.outlets.map((outlet) => <li key={outlet}>{outlet}</li>)}</ul></section>)}</div></details>
      <div className="map-notes"><div><p className="eyebrow">First exploration</p><h2>Find your next campus stop.</h2><p>Red outlines highlight buildings with Wisconsin Union dining. Some buildings house several outlets; hover or select one to see its options. Terrace and seasonal outlets are grouped with Memorial Union.</p></div><div><p className="eyebrow">Sources & scope</p><p>Basemap and building shapes: <a href="https://www.openstreetmap.org/">OpenStreetMap</a>. Map tiles load over the internet. Shapes represent buildings, not exact counter locations or an official campus boundary.</p><p>Dining listings: <a href={DINING_SOURCE}>Wisconsin Union’s food & drink directory ↗</a>. Checked {diningData.checked}; listings include seasonal options and do not indicate what is open now.</p><a className="map-issue" href="https://www.openstreetmap.org/fixthemap">Report a basemap issue ↗</a></div></div>
    </div>
  );
}
