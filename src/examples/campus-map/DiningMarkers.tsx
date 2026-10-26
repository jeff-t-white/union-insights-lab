import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GeoProjection } from 'd3';
import campusData from './campus-dining.json';
import vendingData from './vending-locations.json';
import { diningKind, LocationSymbol, symbolLabels, type LocationKind } from './LocationSymbol';

export const providers = [
  { id: 'union', label: 'Wisconsin Union' },
  { id: 'housing', label: 'University Housing' },
  { id: 'other', label: 'Other Dining Options' },
] as const;
export type Provider = typeof providers[number]['id'];
export type DiningLocation = Omit<typeof campusData.locations[number], 'properties'> & {
  properties: typeof campusData.locations[number]['properties'] & {
    kind?: 'vending'; address?: string; areas?: string[]; machineCount?: number; locationCount?: number;
  };
};
export const campusLocations: DiningLocation[] = [
  ...campusData.locations,
  ...vendingData.buildings.map((building) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: building.coordinates },
    properties: {
      name: `Vending · ${building.name}`, provider: building.provider, kind: 'vending' as const,
      sourceName: building.id, buildingName: building.name, buildingId: `campus-map/${building.mapObjectId}`,
      sourceUrl: vendingData.coordinateSource,
      locationUrl: `https://map.wisc.edu/?initObj=${building.buildingNumber}`,
      coordinateMeaning: vendingData.coordinateMeaning, logoPath: null, orderUrl: null,
      address: building.address, areas: building.areas, machineCount: building.machineCount, locationCount: building.locationCount,
    },
  })),
];

export function locationKind(location: DiningLocation): LocationKind {
  return location.properties.kind ?? diningKind(location.properties.name, location.properties.provider);
}
export function displayProvider(location: DiningLocation): Provider {
  return location.properties.kind === 'vending' ? 'other' : location.properties.provider as Provider;
}

export function DiningMarkers({ locations, projection, width, height, selected, onSelect, onActivate, moving, popupRoot }: {
  locations: DiningLocation[]; projection: GeoProjection; width: number; height: number;
  onActivate: () => void; moving: boolean; popupRoot: HTMLElement | null;
  selected: DiningLocation | null; onSelect: (location: DiningLocation | null) => void;
}) {
  const [hovered, setHovered] = useState<DiningLocation | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const points = locations.map((location) => {
    const [x, y] = projection([location.geometry.coordinates[0], location.geometry.coordinates[1]])!;
    return { id: location.properties.sourceName, x, y, location };
  }).filter(({ x, y }) => x >= 0 && y >= 0 && x <= width && y <= height);
  const active = !moving && locations.find((location) => location === (hovered ?? selected));
  function keepOpen() {
    if (timer.current) clearTimeout(timer.current);
  }
  function close() {
    keepOpen();
    if (timer.current) clearTimeout(timer.current);
    setHovered(null); onSelect(null);
  }
  function show(location: DiningLocation) {
    if (moving) return;
    keepOpen();
    if (timer.current) clearTimeout(timer.current);
    onActivate();
    setHovered(location);
  }
  function leave() {
    // Cancel the previous close before scheduling another boundary leave.
    keepOpen();
    if (popup.current?.contains(document.activeElement)) return;
    timer.current = setTimeout(() => setHovered(null), 450);
  }
  useEffect(() => { if (moving) { keepOpen(); setHovered(null); } }, [moving]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!active) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !layer.current?.contains(event.target) && !event.target.closest('.location-popup')) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [active]);
  return <>
    <div ref={layer} className="dining-markers" aria-label="Campus dining and vending locations">
      {points.map(({ location, id, x, y }) => {
        const { name, provider } = location.properties;
        const kind = locationKind(location);
        // Published source names remain unique even when display names are shared.
        return <button key={id} type="button" className={`dining-marker kind-${kind} provider-${displayProvider(location)}${active === location ? ' is-active' : ''}`}
          data-location-id={id} style={{ left: x, top: y }} aria-label={`${name}${location.properties.buildingName && kind !== 'vending' ? ` at ${location.properties.buildingName}` : ""}, ${symbolLabels[kind]}, ${providers.find((item) => item.id === provider)?.label}`}
          aria-pressed={selected === location} onPointerEnter={(event) => { if (event.pointerType !== 'touch') show(location); }} onPointerLeave={(event) => { if (event.pointerType !== 'touch') leave(); }}
          onFocus={() => show(location)} onBlur={leave} onClick={() => {
            if (moving) return;
            keepOpen();
            onSelect(selected === location ? null : location);
          }}
          onKeyDown={(event) => { if (event.key === 'Escape') close(); }}><LocationSymbol kind={kind} /></button>;
      })}
    </div>
    {active && popupRoot && createPortal(<aside ref={popup} className="building-popup location-popup" aria-label="Location details" onPointerEnter={keepOpen} onPointerLeave={leave}
      onFocusCapture={keepOpen} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) leave(); }}>
      <button type="button" className="popup-close" aria-label="Close location details" onClick={close}>×</button>
      <h3>{active.properties.name}</h3>
      <p>{active.properties.kind === 'vending' ? 'Managed by: ' : ''}{providers.find((item) => item.id === active.properties.provider)?.label}</p><p>{active.properties.buildingName}</p>
      {active.properties.kind === 'vending' && <>
        <p>{active.properties.address}</p>
        <p>{active.properties.machineCount} reported machines across {active.properties.locationCount} vendor locations · {vendingData.period}</p>
        <p>Host-building location; exact machine positions and current availability are unconfirmed.</p>
        <ul aria-label="Reported vending areas">{active.properties.areas?.map((area) => <li key={area}>{area}</li>)}</ul>
      </>}
      {active.properties.logoPath && <img className="location-logo" src={`${import.meta.env.BASE_URL}${active.properties.logoPath}`} alt="" width="64" height="64" />}
      {active.properties.orderUrl && <p><a href={active.properties.orderUrl}>Mobile ordering ↗</a></p>}
      <a href={active.properties.locationUrl}>{active.properties.kind === 'vending' ? 'Host building on UW campus map ↗' : 'Location information & hours ↗'}</a>
    </aside>, popupRoot)}
  </>;
}
