import { useEffect, useRef, useState } from 'react';
import type { GeoProjection } from 'd3';
import campusData from './campus-dining.json';

export const providers = [
  { id: 'union', label: 'Wisconsin Union' },
  { id: 'housing', label: 'University Housing' },
  { id: 'other', label: 'Other Dining Options' },
] as const;
export type Provider = typeof providers[number]['id'];
export const campusLocations = campusData.locations;
export type DiningLocation = typeof campusLocations[number];

export function DiningMarkers({ locations, projection, width, height, selected, onSelect, onActivate }: {
  locations: DiningLocation[]; projection: GeoProjection; width: number; height: number;
  onActivate: () => void;
  selected: DiningLocation | null; onSelect: (location: DiningLocation | null) => void;
}) {
  const [hovered, setHovered] = useState<DiningLocation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = locations.find((location) => location === (hovered ?? selected));
  function show(location: DiningLocation) {
    if (timer.current) clearTimeout(timer.current);
    onActivate();
    setHovered(location);
  }
  function leave() { timer.current = setTimeout(() => setHovered(null), 180); }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <>
    <div className="dining-markers" aria-label="Campus dining locations">
      {locations.map((location) => {
        const [x, y] = projection([location.geometry.coordinates[0], location.geometry.coordinates[1]])!;
        if (x < 0 || y < 0 || x > width || y > height) return null;
        const { name, provider } = location.properties;
        // Published source names remain unique even when display names are shared.
        return <button key={location.properties.sourceName} type="button" className={`dining-marker provider-${provider}${active === location ? ' is-active' : ''}`}
          style={{ left: x, top: y }} aria-label={`${name}, ${providers.find((item) => item.id === provider)?.label}`}
          aria-pressed={selected === location} onPointerEnter={() => show(location)} onPointerLeave={leave}
          onFocus={() => show(location)} onBlur={leave} onClick={() => onSelect(selected === location ? null : location)}
          onKeyDown={(event) => { if (event.key === 'Escape') { setHovered(null); onSelect(null); } }}><span /></button>;
      })}
    </div>
    {active && <aside className="building-popup location-popup" aria-label="Dining location details" onPointerEnter={() => show(active)} onPointerLeave={leave}>
      <button type="button" className="popup-close" aria-label="Close dining location details" onClick={() => { setHovered(null); onSelect(null); }}>×</button>
      <h3>{active.properties.name}</h3>
      <p>{providers.find((item) => item.id === active.properties.provider)?.label}</p><p>{active.properties.buildingName}</p>
      {active.properties.logoPath && <img className="location-logo" src={`${import.meta.env.BASE_URL}${active.properties.logoPath}`} alt="" width="64" height="64" />}
      {active.properties.orderUrl && <p><a href={active.properties.orderUrl}>Mobile ordering ↗</a></p>}
      <a href={active.properties.locationUrl}>Location information & hours ↗</a>
    </aside>}
  </>;
}
