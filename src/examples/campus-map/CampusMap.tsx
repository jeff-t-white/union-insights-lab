import { geoMercator } from 'd3';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { DINING_SOURCE } from './mapConfig';
import { QuietBasemap } from './QuietBasemap';
import { fitDiningView } from './fitDiningView';
import './campus-map.css';
import diningData from './campus-dining.json';
import { OutletList } from './OutletList';
import { DiningMarkers, VendingDetails, campusLocations, providers, locationKind, displayProvider, type Provider, type DiningLocation } from './DiningMarkers';
import vendingData from './vending-locations.json';
import { diningKind, LocationSymbol, symbolLabels, type LocationKind } from './LocationSymbol';

const TILE_SIZE = 256;
const buildingPoints = diningData.buildings.flatMap((building) => building.rings.flat());
const diningPoints = [...buildingPoints, ...campusLocations.filter((location) => location.properties.kind !== 'vending').map((location) => location.geometry.coordinates)];
const diningCenter = fitDiningView(diningPoints, 1000, 600).center;
const locationKinds = Object.keys(symbolLabels) as LocationKind[];
const defaultLocationKinds = locationKinds.filter((kind) => kind !== 'vending');
function filteredMap(enabled: Provider[], kinds: LocationKind[]) {
  const locations = campusLocations.filter((location) => enabled.includes(displayProvider(location)) && kinds.includes(locationKind(location)));
  const buildings = diningData.buildings.map((building) => ({ ...building, outlets: building.outlets.filter((outlet) => enabled.includes(outlet.provider as Provider) && kinds.includes(diningKind(outlet.name, outlet.provider))) })).filter((building) => building.outlets.length);
  const vendingBuildings = vendingData.buildings.filter((building) => locations.some((location) => location.properties.sourceName === building.id));
  return { locations, buildings, vendingBuildings, points: [...buildings.flatMap((building) => building.rings.flat()), ...vendingBuildings.flatMap((building) => building.rings.flat()), ...locations.map((location) => location.geometry.coordinates)] };
}

export function CampusMap() {
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const nativeMap = useRef<MapLibreMap | null>(null);
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const [moving, setMoving] = useState(false);
  const [view, setView] = useState({ center: diningCenter, zoom: 15 });
  const initialFit = useRef(false);
  const [defaultZoom, setDefaultZoom] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<Provider[]>(['union', 'housing', 'other']);
  const [enabledKinds, setEnabledKinds] = useState<LocationKind[]>(defaultLocationKinds);
  const [selectedLocation, setSelectedLocation] = useState<DiningLocation | null>(null);
  const { locations: visibleLocations, buildings: visibleBuildings, vendingBuildings: visibleVendingBuildings, points: visiblePoints } = filteredMap(enabled, enabledKinds);
  const viewPoints = visiblePoints.length ? visiblePoints : diningPoints;
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(500);
  const { center, zoom } = view;
  const [tileError, setTileError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showBuilding(id: string) {
    if (moving) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setSelectedLocation(null);
    setHoveredId(id);
  }
  function leaveBuilding() {
    hoverTimer.current = setTimeout(() => setHoveredId(null), 180);
  }
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  const selected = visibleBuildings.find((building) => building.id === (hoveredId ?? selectedId));
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
    // Native fullscreen handles Escape itself; support its CSS fallback too.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && shell.current?.classList.contains('maplibregl-pseudo-fullscreen')) {
        shell.current.querySelector<HTMLButtonElement>('.maplibregl-ctrl-shrink')?.click();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const projection = geoMercator().scale(TILE_SIZE * 2 ** zoom / (2 * Math.PI)).center(center).translate([width / 2, height / 2]);
  function navigate(nextCenter: [number, number], nextZoom: number, duration = 400) {
    nativeMap.current?.easeTo({ center: nextCenter, zoom: Math.max(11, Math.min(17, nextZoom - 1)), duration });
  }
  useEffect(() => {
    if (!overlayRoot || !width || !height || initialFit.current) return;
    initialFit.current = true;
    const fit = fitDiningView(viewPoints, width, height);
    setDefaultZoom(fit.zoom);
    navigate(fit.center, fit.zoom, 0);
  }, [overlayRoot, width, height, viewPoints]);
  function footprintPath(rings: number[][][]) {
    return rings.map((ring) => ring.map((point, index) => {
      const [x, y] = projection([point[0], point[1]])!;
      return `${index ? 'L' : 'M'}${x},${y}`;
    }).join(' ') + 'Z').join(' ');
  }

  function reset() {
    const fit = fitDiningView(viewPoints, width, height);
    navigate(fit.center, fit.zoom);
    setSelectedLocation(null);
    setTileError(false);
    setSelectedId(null);
    setHoveredId(null);
  }

  return (
    <div className="campus-example">
      <div ref={shell} className="map-shell">
      <div className="map-toolbar">
        <div><strong>UW–Madison campus</strong><span>Campus dining & vending</span></div>
        <div className="map-toolbar-actions">
          <button type="button" onClick={reset}>Reset campus view</button>
        </div>
      </div>
      <fieldset className="provider-filters"><legend>Dining providers</legend>{providers.map((provider) => <label key={provider.id} className={`provider-${provider.id}`}><input type="checkbox" checked={enabled.includes(provider.id)} onChange={() => {
        const next = enabled.includes(provider.id) ? enabled.filter((id) => id !== provider.id) : [...enabled, provider.id];
        setEnabled(next); setSelectedLocation(null); setSelectedId(null); setHoveredId(null);
      }} /><span className="provider-symbol" />{provider.label}</label>)}
        <span aria-live="polite">{visibleLocations.filter((location) => location.properties.kind !== 'vending').length} dining · {visibleLocations.filter((location) => location.properties.kind === 'vending').length} vending buildings shown</span>
      </fieldset>
      <fieldset className="symbol-legend"><legend>Location types</legend>{locationKinds.map((kind) => <label key={kind} className={kind === 'vending' ? 'provider-other' : undefined}>
        <input type="checkbox" checked={enabledKinds.includes(kind)} onChange={() => {
          const next = enabledKinds.includes(kind) ? enabledKinds.filter((item) => item !== kind) : [...enabledKinds, kind];
          setEnabledKinds(next); setSelectedLocation(null); setSelectedId(null); setHoveredId(null);
        }} /><LocationSymbol kind={kind} />{symbolLabels[kind]}
      </label>)}</fieldset>
      <div className="map-frame" ref={container} data-zoom={zoom}>
        <QuietBasemap center={center} zoom={zoom} width={width} height={height} shell={shell} onReady={(map, root) => { nativeMap.current = map; setOverlayRoot(root); }}
          onViewChange={(nextCenter, nextZoom) => setView((previous) => previous.zoom === nextZoom && previous.center[0] === nextCenter[0] && previous.center[1] === nextCenter[1] ? previous : { center: nextCenter, zoom: nextZoom })}
          onMovementChange={(value) => { setMoving(value); if (value) { if (hoverTimer.current) clearTimeout(hoverTimer.current); setSelectedLocation(null); setSelectedId(null); setHoveredId(null); } }}
          onError={() => setTileError(true)} />
        {overlayRoot && createPortal(<>
        <svg className="map-description" width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>Street map of the UW–Madison campus</title>
          <desc id={descriptionId}>Campus and surrounding streets along the south shore of Lake Mendota. Symbols identify cafés, cafeterias, markets, restaurants, and vending host buildings. Provider colors are red for Union, blue for Housing, and green for Other, including vending. Purple footprints identify shared dining buildings. The location directory below provides the same information.</desc>
        </svg>
        <svg className="building-overlay vending-overlay provider-other" width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} aria-hidden="true">
          {visibleVendingBuildings.filter((building) => !visibleBuildings.some((dining) => dining.id === building.diningBuildingId)).map((building) => <path key={building.id} data-vending-building={building.id} d={footprintPath(building.rings)} className="vending-footprint" />)}
        </svg>
        <svg className="building-overlay" width="100%" height={height} viewBox={`0 0 ${width || 1} ${height}`} aria-label="Dining building highlights">
          {visibleBuildings.map((building) => <path key={building.id} d={footprintPath(building.rings)} fillRule="evenodd" className={`dining-footprint provider-${new Set(building.outlets.map((outlet) => outlet.provider)).size > 1 ? 'shared' : building.outlets[0].provider}${selected?.id === building.id ? ' is-active' : ''}`} tabIndex={0} role="button" aria-label={`${building.name}: ${building.outlets.map((outlet) => outlet.name).join(', ')}`} aria-pressed={selectedId === building.id}
            onPointerEnter={() => showBuilding(building.id)} onPointerLeave={leaveBuilding}
            onFocus={() => showBuilding(building.id)} onBlur={leaveBuilding}
            onClick={() => { if (!nativeMap.current?.isMoving()) setSelectedId((value) => value === building.id ? null : building.id); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId((value) => value === building.id ? null : building.id); } if (event.key === 'Escape') { setSelectedId(null); setHoveredId(null); } }}><title>{building.name}</title></path>)}
        </svg>
        <DiningMarkers offsetVending={defaultZoom !== null && zoom > defaultZoom + 0.01} popupRoot={container.current} moving={moving} key={`${enabled.join(',')}-${enabledKinds.join(',')}`} onActivate={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setSelectedId(null); setHoveredId(null); }} locations={visibleLocations} projection={projection} width={width} height={height} selected={selectedLocation} onSelect={(location) => { setSelectedLocation(location); setSelectedId(null); setHoveredId(null); }} />
        {!visibleLocations.length && <p className="map-empty" role="status">Choose a provider and location type above to show locations.</p>}
        </>, overlayRoot)}
        {selected && <aside className="building-popup" aria-label="Dining building details" onPointerEnter={() => showBuilding(selected.id)} onPointerLeave={leaveBuilding}>
          <button className="popup-close" type="button" aria-label="Close building details" onClick={() => { setSelectedId(null); setHoveredId(null); }}>×</button>
          <h3>{selected.name}</h3><p>{selected.address}</p><p>{providers.filter((provider) => selected.outlets.some((outlet) => outlet.provider === provider.id)).map((provider) => provider.label).join(" · ")}</p>
          <OutletList outlets={selected.outlets} />

        </aside>}

        <div className="map-attribution"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></div>
      </div>
      </div>
      {tileError && <p className="map-error" role="status">The background map couldn’t fully load. Check your internet connection and reload the page. You can still browse the dining lists below.</p>}
      <p className="map-instructions">Drag to explore. Double-click to zoom in; Shift + double-click to zoom out. Hold Ctrl (⌘ on Mac) and scroll to zoom, or use + and −. On touchscreens, use two fingers to pan or pinch to zoom. Use the fullscreen icon for full screen, or Locate me to show your position. Hover, focus, or tap a marker for location details. Select a shaded building for its dining options. Filters update the visible locations without changing your map position or zoom. Purple shading indicates a building shared by providers.</p>
      <details className="dining-list"><summary>Browse dining & vending locations ({visibleLocations.length})</summary><div>{visibleLocations.map((location) => <section key={location.properties.sourceName}><button type="button" onClick={() => { navigate(location.geometry.coordinates as [number, number], 18); setSelectedLocation(location); setSelectedId(null); setHoveredId(null); container.current?.scrollIntoView({ block: 'center' }); }}>{location.properties.name} ↗</button><p>{location.properties.buildingName ? `${location.properties.buildingName} · ` : ""}{location.properties.managementLabel ?? providers.find((provider) => provider.id === location.properties.provider)?.label}</p>{location.properties.kind === 'vending' && <VendingDetails location={location} />}<a href={location.properties.locationUrl}>{location.properties.kind === 'vending' ? 'Host building on UW campus map ↗' : 'Location information & hours ↗'}</a></section>)}</div></details>
      <details className="dining-list"><summary>Browse dining by building ({visibleBuildings.length} buildings)</summary><div>{visibleBuildings.map((building) => <section key={building.id}><button type="button" onClick={() => { const points = building.rings[0]; navigate([points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length], 17); setSelectedLocation(null); setSelectedId(building.id); setHoveredId(null); container.current?.scrollIntoView({ block: 'center' }); }}>{building.name} ↗</button><p>{building.address}</p><OutletList outlets={building.outlets} /></section>)}</div></details>
      <p className="vending-scope">Vending: {vendingData.period} provider report, matched to <a href="https://map.wisc.edu/">UW campus map buildings</a>. {vendingData.totalLocations - vendingData.unresolved.length} sales locations plus {vendingData.supplementalMappedLocations} supplemental lookup references are grouped into {vendingData.buildings.length} building markers. {vendingData.unresolved.length} sales locations and {vendingData.supplementalPending.length} supplemental references await names or building confirmation and are omitted. Lookup-only buildings are identified in their details; supplemental references do not establish current machine counts. All vending markers are green and grouped under Other Dining Options; management details remain in the location information. These are host-building reference points, not exact machine positions or a complete current inventory.</p>
      <details className="dining-list"><summary>Vending references awaiting building confirmation ({vendingData.supplementalPending.length})</summary><div>{vendingData.supplementalPending.map((item) => <section key={`${item.location}-${item.name}`}><strong>{item.name ?? `Unnamed vendor location ${item.location}`}</strong><p>{item.reason}</p></section>)}</div></details>
      <div className="map-notes"><div><p className="eyebrow">First exploration</p><h2>Find your next campus stop.</h2><p>Building shading follows the provider colors above. Purple identifies buildings with more than one active provider. Some buildings house several outlets; hover or select one to see its options. Terrace and seasonal outlets are grouped with Memorial Union.</p></div><div><p className="eyebrow">Sources & scope</p><p>Light basemap: <a href="https://openfreemap.org/">OpenFreeMap</a> / <a href="https://openmaptiles.org/">OpenMapTiles</a>. Map data and building shapes: <a href="https://www.openstreetmap.org/">OpenStreetMap</a>. Map tiles load over the internet. Shapes represent buildings, not exact counter locations or an official campus boundary.</p><p>Marker coordinates: <a href="https://www.wisc.edu/dining/">UW–Madison dining map ↗</a>. Additional coordinates for Veterinary Medicine, Pedone Pinsa, and Hosto were supplied by Wisconsin Union staff. Published positions are not surveyed counter locations. Babcock is included under Other Dining Options; Pasta Pronto is excluded. Union outlets missing from that source remain in the building listings.</p><p>Dining listings: <a href={DINING_SOURCE}>Wisconsin Union’s food & drink directory ↗</a>. Names and available logos updated from <a href="https://weborder.transactcampus.com/230">Union mobile ordering ↗</a>. Checked {diningData.checked}; the map also includes Union outlets not on mobile ordering. Seasonal listings do not indicate what is open now.</p><a className="map-issue" href="https://www.openstreetmap.org/fixthemap">Report a basemap issue ↗</a></div></div>
    </div>
  );
}
