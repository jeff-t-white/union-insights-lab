import { useId } from 'react';

export const zones = Array.from({ length: 36 }, (_, i) => `${'ABCDEF'[i % 6]}${Math.floor(i / 6) + 1}`);
const xs = [78, 174, 253, 342, 431, 511, 617];
const ys = [20, 180, 262, 342, 404, 468, 625];
const terrace = 'M78 20H126V151H175V142Q185 85 239 85H442Q508 88 510 156H617V587H554V544Q525 540 491 505Q453 445 393 440Q302 423 238 469Q194 504 153 541V625H85V412H73V184H78Z';

export function ZoneMap({ counts, totalCounts, activeZone, filterZone, onZone }: { counts: Record<string, number>; totalCounts: Record<string, number>; activeZone: string | null; filterZone: string; onZone: (zone: string) => void }) {
  const clip = useId();
  return <svg className="paver-zone-map" viewBox="0 0 680 690" role="group" aria-label="Conceptual Terrace zones from the supplied reference map. Select a zone to filter records; positions are unverified.">
    <defs><clipPath id={clip}><path d={terrace} /></clipPath></defs>
    <text x="350" y="22" className="zone-orientation" textAnchor="middle">TERRACE / LAKE SIDE</text>
    <path d={terrace} fill="#ecf0e7" stroke="#87937f" strokeWidth="2" />
    <g className="zone-landmarks" aria-hidden="true"><circle cx="405" cy="160" r="38" /><circle cx="453" cy="384" r="28" /><circle cx="160" cy="364" r="19" /></g>
    {zones.map((zone, i) => {
      const col = i % 6, row = Math.floor(i / 6), count = counts[zone] ?? 0;
      const x = xs[col], y = ys[row], w = xs[col + 1] - x, h = ys[row + 1] - y;
      const selected = activeZone === zone || filterZone === zone;
      const alpha = count ? .14 + .45 * Math.sqrt(count / Math.max(1, ...Object.values(counts))) : 0;
      const labelY = row === 0 ? (col === 0 ? 105 : 137) : row === 5 ? (col === 0 ? 558 : col === 5 ? 531 : 516) : y + h / 2;
      return <g key={zone} role="button" tabIndex={0} aria-label={`Zone ${zone}: ${count} matching records, ${totalCounts[zone] ?? 0} total. Select to filter.`} aria-pressed={filterZone === zone} className={`paver-zone${selected ? ' is-active' : ''}${!count ? ' is-empty' : ''}`} onClick={() => onZone(zone)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onZone(zone); } }}>
        <title>{zone} · {count} matching records · supplied zone, current position unverified</title>
        <rect x={x} y={y} width={w} height={h} fill={selected ? '#e5bb57' : `rgba(45,88,65,${alpha})`} clipPath={`url(#${clip})`} />
        <rect className="zone-cell-border" x={x} y={y} width={w} height={h} fill="transparent" stroke={selected ? '#9c681a' : '#84947a'} strokeWidth={selected ? 3 : .7} strokeDasharray={selected ? undefined : '3 3'} />
        <text x={x + w / 2} y={labelY - 5} textAnchor="middle" className="zone-code">{zone}</text>
        <text x={x + w / 2} y={labelY + 15} textAnchor="middle" className="zone-count">{count}</text>
      </g>;
    })}
    <g className="zone-landmarks" aria-hidden="true"><text x="139" y="47">Brat Stand</text><text x="352" y="592" textAnchor="middle" className="zone-building">Rathskeller</text><text x="352" y="613" textAnchor="middle">Building side</text></g>
    <text x="340" y="672" textAnchor="middle" className="zone-orientation">SCHEMATIC REFERENCE · NOT A CURRENT PAVER SURVEY</text>
  </svg>;
}
