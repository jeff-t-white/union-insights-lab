import { geoMercator } from 'd3';
import { useEffect, useId, useRef, useState } from 'react';
import { DINING_SOURCE, TILE_URL } from './mapConfig';
import { fitDiningView } from './fitDiningView';
import './campus-map.css';
import diningData from './dining-buildings.json';
import { OutletList } from './OutletList';
import { DiningMarkers, campusLocations, providers, type Provider, type DiningLocation } from './DiningMarkers';

const TILE_SIZE = 256;
const buildingPoints = diningData.buildings.flatMap((building) => building.rings.flat());
const diningPoints = [...buildingPoints, ...campusLocations.map((location) => location.geometry.coordinates)];
const diningCenter = fitDiningView(diningPoints, 1000, 600).center;

export function CampusMap() {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; center: [number, number] } | null>(null);
  const [enabled, setEnabled] = useState<Provider[]>(['union', 'housing', 'other']);
  const [selectedLocation, setSelectedLocation] = useState<DiningLocation | null>(null);
  const visibleLocations = campusLocations.filter((location) => enabled.includes(location.properties.provider as Provider));
  const visiblePoints = [...(enabled.includes('union') ? buildingPoints : []), ...visibleLocations.map((location) => location.geometry.coordinates)];
  const viewPoints = visiblePoints.length ? visiblePoints : diningPoints;
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(500);
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [center, setCenter] = useState<[number, number]>(diningCenter);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showBuilding(id: string) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setSelectedLocation(null);
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

  const baseZoom = fitDiningView(viewPoints, width, height).zoom;
  const zoom = Math.max(12, Math.min(18, baseZoom + zoomOffset));
  const tileZoom = Math.floor(zoom);
  const tileDisplaySize = TILE_SIZE * 2 ** (zoom - tileZoom);
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
    setZoomOffset(nextZoom - baseZoom);
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
    for (let x = Math.floor(left / tileDisplaySize); x <= Math.floor((left + width) / tileDisplaySize); x++) {
      for (let y = Math.floor(top / tileDisplaySize); y <= Math.floor((top + height) / tileDisplaySize); y++) {
        if (x < 0 || y < 0 || x >= 2 ** tileZoom || y >= 2 ** tileZoom) continue;
        tiles.push({ x, y, url: TILE_URL.replace('{z}', String(tileZoom)).replace('{x}', String(x)).replace('{y}', String(y)) });
      }
    }
  }

  function reset() {
    setCenter(fitDiningView(viewPoints, width, height).center);
    setSelectedLocation(null);
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
      <fieldset className="provider-filters"><legend>Dining providers</legend>{providers.map((provider) => <label key={provider.id} className={`provider-${provider.id}`}><input type="checkbox" checked={enabled.includes(provider.id)} onChange={() => {
        const next = enabled.includes(provider.id) ? enabled.filter((id) => id !== provider.id) : [...enabled, provider.id];
        setEnabled(next); setSelectedLocation(null); setSelectedId(null); setHoveredId(null);
        const points = [...(next.includes('union') ? buildingPoints : []), ...campusLocations.filter((location) => next.includes(location.properties.provider as Provider)).map((location) => location.geometry.coordinates)];
        setCenter(fitDiningView(points.length ? points : diningPoints, width, height).center); setZoomOffset(0);
      }} /><span className="provider-symbol" />{provider.label} ({campusLocations.filter((location) => location.properties.provider === provider.id).length})</label>)}<span aria-live="polite">{visibleLocations.length} locations shown</span></fieldset>
      <div className="map-frame" ref={container}>
        <svg width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>Street map of the UW–Madison campus</title>
          <desc id={descriptionId}>Campus and surrounding streets along the south shore of Lake Mendota. Red footprints highlight buildings with Union dining. The building list below provides the same information.</desc>
          {tiles.map((tile) => <image key={`${tileZoom}/${tile.x}/${tile.y}`} href={tile.url} x={tile.x * tileDisplaySize - left} y={tile.y * tileDisplaySize - top} width={tileDisplaySize + 0.5} height={tileDisplaySize + 0.5} onError={() => setTileError(true)} />)}
        </svg>
        <div className="map-drag-surface" aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            setSelectedLocation(null);
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
          {enabled.includes('union') && diningData.buildings.map((building) => <path key={building.id} d={footprintPath(building.rings)} fillRule="evenodd" className={`dining-footprint${selected?.id === building.id ? ' is-active' : ''}`} tabIndex={0} role="button" aria-label={`${building.name}: ${building.outlets.map((outlet) => outlet.name).join(', ')}`} aria-pressed={selectedId === building.id}
            onPointerEnter={() => showBuilding(building.id)} onPointerLeave={leaveBuilding}
            onFocus={() => showBuilding(building.id)} onBlur={leaveBuilding}
            onClick={() => setSelectedId((value) => value === building.id ? null : building.id)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId((value) => value === building.id ? null : building.id); } if (event.key === 'Escape') { setSelectedId(null); setHoveredId(null); } }}><title>{building.name}</title></path>)}
        </svg>
        {selected && <aside className="building-popup" aria-label="Dining building details" onPointerEnter={() => showBuilding(selected.id)} onPointerLeave={leaveBuilding}>
          <button className="popup-close" type="button" aria-label="Close building details" onClick={() => { setSelectedId(null); setHoveredId(null); }}>×</button>
          <h3>{selected.name}</h3><p>{selected.address}</p>
          <OutletList outlets={selected.outlets} />
          <a href={DINING_SOURCE}>Current hours & menus ↗</a>
        </aside>}
        <DiningMarkers locations={visibleLocations} projection={projection} width={width} height={height} selected={selectedLocation} onSelect={(location) => { setSelectedLocation(location); setSelectedId(null); setHoveredId(null); }} />
        {!visibleLocations.length && <p className="map-empty" role="status">Choose a dining provider above to show locations.</p>}
        <div className="map-controls" role="group" aria-label="Map controls">
          <button type="button" aria-label="Zoom in" disabled={zoom === 18} onClick={() => changeZoom(1)}>+</button>
          <button type="button" aria-label="Zoom out" disabled={zoom === 12} onClick={() => changeZoom(-1)}>−</button>
        </div>
        <span className="map-north" aria-hidden="true">↑ N</span>
        <div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></div>
      </div>
      </div>
      {tileError && <p className="map-error" role="status">Some map tiles couldn’t load. Check your internet connection, then reset the view or reload the page.</p>}
      <p className="map-instructions">Drag to explore. Hold Ctrl and scroll to zoom toward your cursor, or use + and −. Hover, focus, or tap a marker for location details, or a red building for all its Union outlets.</p>
      <details className="dining-list"><summary>Browse dining locations ({visibleLocations.length})</summary><div>{visibleLocations.map((location) => <section key={location.properties.name}><button type="button" onClick={() => { setCenter(location.geometry.coordinates as [number, number]); setZoomOffset(18 - baseZoom); setSelectedLocation(location); setSelectedId(null); setHoveredId(null); container.current?.scrollIntoView({ block: 'center' }); }}>{location.properties.name} ↗</button><p>{providers.find((provider) => provider.id === location.properties.provider)?.label}</p><a href={location.properties.locationUrl}>Location information & hours ↗</a></section>)}</div></details>
      {enabled.includes('union') && <details className="dining-list"><summary>Browse dining by building ({diningData.buildings.length} buildings)</summary><div>{diningData.buildings.map((building) => <section key={building.id}><button type="button" onClick={() => { const points = building.rings[0]; setCenter([points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length]); setZoomOffset(17 - baseZoom); setSelectedId(building.id); setHoveredId(null); container.current?.scrollIntoView({ block: 'center' }); }}>{building.name} ↗</button><p>{building.address}</p><OutletList outlets={building.outlets} /></section>)}</div></details>}
      <div className="map-notes"><div><p className="eyebrow">First exploration</p><h2>Find your next campus stop.</h2><p>Red outlines highlight buildings with Wisconsin Union dining. Some buildings house several outlets; hover or select one to see its options. Terrace and seasonal outlets are grouped with Memorial Union.</p></div><div><p className="eyebrow">Sources & scope</p><p>Basemap and building shapes: <a href="https://www.openstreetmap.org/">OpenStreetMap</a>. Map tiles load over the internet. Shapes represent buildings, not exact counter locations or an official campus boundary.</p><p>Marker coordinates: <a href="https://www.wisc.edu/dining/">UW–Madison dining map ↗</a>. Published positions are not surveyed counter locations. Babcock is included under Other Dining Options; Pasta Pronto is excluded. Union outlets missing from that source remain in the building listings.</p><p>Dining listings: <a href={DINING_SOURCE}>Wisconsin Union’s food & drink directory ↗</a>. Names and available logos updated from <a href="https://weborder.transactcampus.com/230">Union mobile ordering ↗</a>. Checked {diningData.checked}; the map also includes Union outlets not on mobile ordering. Seasonal listings do not indicate what is open now.</p><a className="map-issue" href="https://www.openstreetmap.org/fixthemap">Report a basemap issue ↗</a></div></div>
    </div>
  );
}
