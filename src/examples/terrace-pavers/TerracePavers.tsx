import { useEffect, useRef, useState } from 'react';
import layout from './photo-layout.json';
import './terrace-pavers.css';

type View = { x: number; y: number; scale: number };
type Point = [number, number];
const asset = (file: string) => `${import.meta.env.BASE_URL}terrace-pavers/${file}`;
const samples = [
  { id: 'eastman', photo: 'IMG_3316', title: 'Laura & Greg Eastman', text: 'LAURA & GREG\nEASTMAN\nFAMILY\n\nON\nWISCONSIN!', rect: [787, 335, 1032, 569] },
  { id: 'gibson', photo: 'IMG_3319', title: 'Gibson family', text: 'GIBSON\nFAMILY\nMEMORIES\nHERE', rect: [982, 231, 1231, 489] },
  { id: 'christianson', photo: 'IMG_3320', title: 'Margaret Christianson', text: 'IN LOVING MEMORY OF\nMARGARET CHRISTIANSON\nFROM AMY BA 2007\nNICHOLAS BS 2006\nANDREW BBA 2002, JD 2005\nPETER BA 1971, JD 1977', rect: [966, 449, 1454, 681] },
  { id: 'kamp', photo: 'IMG_3322', title: 'William Kamp', text: 'CONGRATS\nWILLIAM\nCLASS OF\n2015\nKAMP\nFAMILY', rect: [364, 232, 632, 485] },
  { id: 'council', photo: 'IMG_3323', title: 'Union Council / Union staff', text: 'UNION COUNCIL EXPRESSES\nAPPRECIATION TO THE\nUNION STAFF\nWHOSE DEDICATION, HARD\nWORK AND ADVICE ALLOW\nALL STUDENTS, FACULTY,\nSTAFF, ALUMNI & UNION\nMEMBERS TO CALL THIS\nPLACE THEIR OWN', rect: [610, 258, 1115, 704] },
];
function project(matrix: number[][], x: number, y: number): Point {
  const d = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2];
  return [(matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / d, (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / d];
}
const mappedSamples = samples.map((sample) => {
  const photo = layout.images.find((image) => image.id === sample.photo)!;
  // Rectangles were marked against the supplied 1824 x 1368 previews.
  const [x1, y1, x2, y2] = sample.rect;
  const corners = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => project(photo.matrix, photo.width * (1 - x / 1824), photo.height * (1 - y / 1368)));
  const center: Point = [corners.reduce((sum, p) => sum + p[0], 0) / 4, corners.reduce((sum, p) => sum + p[1], 0) / 4];
  return { ...sample, corners, center };
});
function cssMatrix(h: number[][]) {
  return `matrix3d(${[h[0][0], h[1][0], 0, h[2][0], h[0][1], h[1][1], 0, h[2][1], 0, 0, 1, 0, h[0][2], h[1][2], 0, h[2][2]].join(',')})`;
}

export function TerracePavers() {
  const frame = useRef<HTMLDivElement>(null);
  const current = useRef<View>({ x: 0, y: 0, scale: .15 });
  const [view, setView] = useState(current.current);
  const [size, setSize] = useState({ width: 800, height: 650 });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [outlines, setOutlines] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ points: Point[]; view: View } | null>(null);
  const update = (next: View) => { current.current = next; setView(next); };
  const fit = (width = size.width, height = size.height) => {
    const scale = Math.min((width - 40) / layout.width, (height - 40) / layout.height);
    update({ scale, x: (width - layout.width * scale) / 2, y: (height - layout.height * scale) / 2 });
  };
  const zoom = (factor: number, point: Point = [size.width / 2, size.height / 2]) => {
    const old = current.current;
    const scale = Math.max(.03, Math.min(8, old.scale * factor));
    update({ scale, x: point[0] - (point[0] - old.x) * scale / old.scale, y: point[1] - (point[1] - old.y) * scale / old.scale });
  };
  useEffect(() => {
    const element = frame.current!;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize(next); fit(next.width, next.height);
    });
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const point: Point = [event.clientX - rect.left, event.clientY - rect.top];
      const old = current.current;
      const scale = Math.max(.03, Math.min(8, old.scale * Math.exp(-event.deltaY * .002)));
      update({ scale, x: point[0] - (point[0] - old.x) * scale / old.scale, y: point[1] - (point[1] - old.y) * scale / old.scale });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); };
  }, []);
  const focusSample = (id: string) => {
    const item = mappedSamples.find((sample) => sample.id === id)!;
    const width = Math.max(...item.corners.map((p) => p[0])) - Math.min(...item.corners.map((p) => p[0]));
    const height = Math.max(...item.corners.map((p) => p[1])) - Math.min(...item.corners.map((p) => p[1]));
    const scale = Math.min(2.8, size.width * .6 / width, size.height * .6 / height);
    update({ scale, x: size.width / 2 - item.center[0] * scale, y: size.height / 2 - item.center[1] * scale });
    setSelected(id);
    const bounds = frame.current!.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) frame.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const resetGesture = () => { gesture.current = { points: [...pointers.current.values()], view: current.current }; };
  const results = mappedSamples.filter((sample) => `${sample.title} ${sample.text}`.toLowerCase().includes(query.toLowerCase()));
  const active = mappedSamples.find((sample) => sample.id === selected);
  return <div className="paver-poc">
    <div className="paver-status"><span className="paver-tag">Photo experiment</span><p>Eight overlapping photographs · five sample inscriptions · approximate alignment</p></div>
    <div className="paver-workspace">
      <div className="paver-map-column">
        <div className="paver-toolbar"><div><strong>Terrace photo mosaic</strong><span>South at the bottom, using your orientation notes</span></div><div className="paver-controls">
          <button type="button" onClick={() => zoom(1.5)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoom(1 / 1.5)} aria-label="Zoom out">−</button><button type="button" onClick={() => { fit(); setSelected(null); }}>Fit section</button>
          <button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void frame.current?.requestFullscreen(); }} aria-label="Toggle photo fullscreen">⛶</button>
        </div></div>
        <div ref={frame} className="paver-viewport" tabIndex={0} role="region" aria-label="Zoomable Terrace photographs. Drag to pan, scroll or pinch to zoom. Plus and minus zoom; Home fits the section."
          onKeyDown={(event) => { if (['+', '=', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault(); if (event.key === '+' || event.key === '=') zoom(1.5); if (event.key === '-') zoom(1 / 1.5); if (event.key === 'Home') fit(); if (event.key.startsWith('Arrow')) update({ ...current.current, x: current.current.x + (event.key === 'ArrowLeft' ? 60 : event.key === 'ArrowRight' ? -60 : 0), y: current.current.y + (event.key === 'ArrowUp' ? 60 : event.key === 'ArrowDown' ? -60 : 0) }); }}
          onPointerDown={(event) => { if ((event.target as Element).closest('button')) return; frame.current?.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, [event.clientX, event.clientY]); resetGesture(); }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId) || !gesture.current) return;
            pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
            const now = [...pointers.current.values()], start = gesture.current.points, old = gesture.current.view;
            if (now.length === 1 && start.length === 1) update({ ...old, x: old.x + now[0][0] - start[0][0], y: old.y + now[0][1] - start[0][1] });
            if (now.length === 2 && start.length === 2) {
              const distance = (p: Point[]) => Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
              const rect = frame.current!.getBoundingClientRect();
              const a = [(start[0][0] + start[1][0]) / 2 - rect.left, (start[0][1] + start[1][1]) / 2 - rect.top];
              const b = [(now[0][0] + now[1][0]) / 2 - rect.left, (now[0][1] + now[1][1]) / 2 - rect.top];
              const scale = Math.max(.03, Math.min(8, old.scale * distance(now) / Math.max(1, distance(start))));
              update({ scale, x: b[0] - (a[0] - old.x) * scale / old.scale, y: b[1] - (a[1] - old.y) * scale / old.scale });
            }
          }} onPointerUp={(event) => { pointers.current.delete(event.pointerId); resetGesture(); }} onPointerCancel={(event) => { pointers.current.delete(event.pointerId); resetGesture(); }}>
          <div className={`paver-world${outlines ? ' show-outlines' : ''}`} style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
            {layout.images.map((photo) => <div key={photo.id} className="paver-photo" style={{ width: photo.width, height: photo.height, transform: cssMatrix(photo.matrix) }}>
              <img src={asset(photo.file)} alt="" draggable={false} style={{ transform: 'rotate(180deg)' }} onLoad={() => setLoaded((old) => old.includes(photo.id) ? old : [...old, photo.id])} onError={() => setFailed(true)} /><span>{photo.id}</span>
            </div>)}
            <svg className="paver-hotspots" width={layout.width} height={layout.height} aria-hidden="true">{mappedSamples.map((sample) => <polygon key={sample.id} points={sample.corners.map((point) => point.join(',')).join(' ')} className={selected === sample.id ? 'is-selected' : ''} />)}</svg>
            {mappedSamples.map((sample, index) => <button type="button" key={sample.id} className={`paver-pin${selected === sample.id ? ' is-selected' : ''}`} style={{ left: selected === sample.id ? sample.corners[2][0] : sample.center[0], top: selected === sample.id ? sample.corners[2][1] : sample.center[1], transform: `translate(-50%, -50%) scale(${1 / view.scale})` }} onClick={() => focusSample(sample.id)} aria-label={`Locate ${sample.title}`} aria-pressed={selected === sample.id}>{index + 1}</button>)}
          </div>
          <div className="paver-orientation" aria-hidden="true">↑ Approx. north</div>
          <button type="button" className="paver-fullscreen-exit" onClick={() => void document.exitFullscreen()}>Exit fullscreen</button>
          {loaded.length < layout.images.length && !failed && <div className="paver-loading" role="status">Loading original photographs · {loaded.length}/8</div>}
          {failed && <div className="paver-loading" role="alert">A photograph could not load. Reload to try again.</div>}
        </div>
        <div className="paver-map-footer"><span>Drag to explore · scroll or pinch to zoom</span><label><input type="checkbox" checked={outlines} onChange={(event) => setOutlines(event.target.checked)} /> Show photo edges</label></div>
      </div>
      <aside className="paver-search" aria-label="Sample paver search"><p className="eyebrow">Try finding an inscription</p><h2>A place in the picture.</h2><label htmlFor="paver-search">Search five sample inscriptions</label><input id="paver-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Gibson or William…" />
        <p className="paver-small">These are hand-marked examples from the photos. The CSV has not been connected.</p>
        <div className="paver-results" aria-live="polite">{results.length ? results.map((sample) => <button type="button" key={sample.id} onClick={() => focusSample(sample.id)} aria-pressed={selected === sample.id}><span>{mappedSamples.indexOf(sample) + 1}</span><strong>{sample.title}</strong><span aria-hidden="true">↗</span></button>) : <p>No sample matches. Only five inscriptions are indexed in this experiment.</p>}</div>
        {active && <section className="paver-detail"><p className="eyebrow">Sample transcription</p><h3>{active.title}</h3><pre>{active.text}</pre><a href={asset(`${active.photo}.jpeg`)} target="_blank" rel="noreferrer">Open original photograph ↗</a><p className="paver-small">Transcribed for this demonstration; verify against the stone before adding to a permanent record.</p></section>}
      </aside>
    </div>
    <div className="paver-notes"><section><p className="eyebrow">What this demonstrates</p><h2>A photographic starting point.</h2><p>The eight downward-facing photos are aligned using shared visual features. The photographs are rotated to put south at the bottom. Small seams and perspective differences remain; this is a proof of concept, not a measured site plan.</p><p>Shoe areas are masked in the combined view. Dark gaps indicate missing coverage. All original photographs remain available below.</p></section><section><p className="eyebrow">Next step</p><h2>Connect the records.</h2><p>With the CSV, verified inscriptions can be linked to positions in this view. Closer photographs can provide clearer individual records. No assignments from the old, pre-restoration map are assumed here.</p></section></div>
    <details className="paver-sources"><summary>See the original photographs and context view</summary><div className="paver-source-grid">{[...layout.images.map((photo) => photo.file), layout.contextImage].map((file) => <a key={file} href={asset(file)} target="_blank" rel="noreferrer"><img loading="lazy" src={asset(file)} alt={file === layout.contextImage ? 'Wider view of the photographed Terrace section, with the building, tree and railing' : `Original source photograph ${file}`} /><span>{file}{file === layout.contextImage ? ' · wider context' : ''} ↗</span></a>)}</div></details>
  </div>;
}
