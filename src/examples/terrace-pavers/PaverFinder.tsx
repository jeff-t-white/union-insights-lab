import { useMemo, useRef, useState } from 'react';
import { TerracePavers } from './TerracePavers';
import { ZoneMap, zones } from './ZoneMap';
import { records, searchPavers, purchaserName, type PaverRecord, type SearchScope } from './paverSearch';
import './paver-finder.css';

const asset = (file: string) => `${import.meta.env.BASE_URL}terrace-pavers/${file}`;
const tally = (items: PaverRecord[]) => items.reduce<Record<string, number>>((counts, record) => { counts[record.zone] = (counts[record.zone] ?? 0) + 1; return counts; }, {});
const totals = tally(records);
const pageSize = 24;

export function PaverFinder() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [zone, setZone] = useState('all');
  const [size, setSize] = useState('all');
  const [panel, setPanel] = useState<'zones' | 'photos'>('zones');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PaverRecord | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const mapTop = useRef<HTMLDivElement>(null);
  const resultTop = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => searchPavers(query, scope, size), [query, scope, size]);
  const counts = useMemo(() => tally(matches), [matches]);
  const filtered = matches.filter((record) => zone === 'all' || record.zone === zone);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const showPhoto = (record: PaverRecord) => {
    setSelected(record); setPhotoId(record.photoSampleId); setPanel('photos');
    mapTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const chooseZone = (value: string) => { setZone((old) => old === value ? 'all' : value); setPage(0); setSelected(null); };
  return <div className="paver-finder">
    <div className="paver-catalog-heading"><div><span className="paver-tag">Working locator</span><p>{records.length.toLocaleString()} records · {Object.keys(totals).length} supplied zones · 5 linked photo examples</p></div><a href={asset('pavers.csv')} download>Download source CSV ↗</a></div>
    <form className="paver-find-form" onSubmit={(event) => { event.preventDefault(); resultTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>
      <div className="paver-main-query"><label htmlFor="find-paver">Find an inscription or purchaser</label><input id="find-paver" type="search" value={query} placeholder="Try a name, phrase, class year…" onChange={(event) => { setQuery(event.target.value); setPage(0); setSelected(null); }} /></div>
      <div><label htmlFor="paver-search-scope">Search in</label><select id="paver-search-scope" value={scope} onChange={(event) => { setScope(event.target.value as SearchScope); setPage(0); setSelected(null); }}><option value="all">Inscription & purchaser</option><option value="inscription">Inscription only</option><option value="purchaser">Purchaser only</option></select></div>
      <div><label htmlFor="paver-zone-filter">Reported zone</label><select id="paver-zone-filter" value={zone} onChange={(event) => { setZone(event.target.value); setPage(0); setSelected(null); }}><option value="all">All zones</option>{zones.map((code) => <option key={code} value={code}>{code} ({totals[code] ?? 0})</option>)}</select></div>
      <div><label htmlFor="paver-size-filter">Paver size</label><select id="paver-size-filter" value={size} onChange={(event) => { setSize(event.target.value); setPage(0); setSelected(null); }}><option value="all">All sizes</option>{['6x12', '12x12', '12x24', '24x24'].map((value) => <option key={value} value={value}>{value.replace('x', ' × ')} in.</option>)}</select></div>
      <button type="button" className="paver-reset" onClick={() => { setQuery(''); setScope('all'); setZone('all'); setSize('all'); setPage(0); setSelected(null); }}>Clear filters</button>
    </form>
    <p className="paver-location-note"><strong>Two ways to explore.</strong> Zone codes come from the supplied CSV and have not been verified after restoration. The photo pilot shows a small current section; only five inscriptions have been linked to photographed pavers.</p>
    <div ref={mapTop} className="paver-explorer" style={{ scrollMarginTop: 20 }}>
      <div className="paver-view-tabs" role="tablist" aria-label="Paver map views" onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 'zones' : event.key === 'End' ? 'photos' : panel === 'zones' ? 'photos' : 'zones'; setPanel(next); document.getElementById(next === 'zones' ? 'zone-tab' : 'photo-tab')?.focus(); }}><button type="button" role="tab" id="zone-tab" tabIndex={panel === 'zones' ? 0 : -1} aria-controls="zone-panel" aria-selected={panel === 'zones'} onClick={() => setPanel('zones')}>Zone guide</button><button type="button" role="tab" id="photo-tab" tabIndex={panel === 'photos' ? 0 : -1} aria-controls="photo-panel" aria-selected={panel === 'photos'} onClick={() => setPanel('photos')}>Photo mosaic <span>Small-area pilot</span></button></div>
      {panel === 'zones' ? <div id="zone-panel" role="tabpanel" aria-labelledby="zone-tab" className="paver-zone-layout"><div><div className="paver-zone-title"><h2>Browse the Terrace zones</h2><p>Select a zone to filter the records. Numbers show matches to your search.</p></div><ZoneMap counts={counts} totalCounts={totals} activeZone={selected?.zone ?? null} filterZone={zone} onZone={chooseZone} /><div className="paver-zone-key"><span><i /> Matching records</span><span><i /> Selected zone</span>{zone !== 'all' && <button type="button" onClick={() => chooseZone(zone)}>Clear {zone} filter ×</button>}</div></div>
        <aside className="paver-zone-info">{selected ? <><p className="eyebrow">Selected record</p><h3>{purchaserName(selected)}</h3><p className="paver-reported-zone">Reported zone <strong>{selected.zone}</strong></p><pre>{selected.lines.join('\n')}</pre><p>{selected.size.replace('x', ' × ')} in. · source row {selected.sourceRow}</p>{selected.photoSampleId ? <><button className="paver-action" type="button" onClick={() => showPhoto(selected)}>Locate in photo pilot ↗</button><p className="paver-small">Photo linked by inscription. Its photographed position does not verify the supplied zone assignment.</p></> : <p className="paver-small">No individual photo position has been linked to this record yet.</p>}</> : <><p className="eyebrow">From zone to stone</p><h3>{zone === 'all' ? 'Start with a name or a memory.' : `Exploring ${zone}`}</h3><p>{zone === 'all' ? 'Search words from an inscription or the purchaser’s name, then select a record to highlight its reported zone.' : `${filtered.length.toLocaleString()} matching records are listed below. Select this zone again to return to all zones.`}</p><div className="paver-zone-stat"><strong>{filtered.length.toLocaleString()}</strong><span>matching records</span></div><p className="paver-small">This is a conceptual redraw of the supplied reference. A zone is a search area, not an exact paver position. Grey/empty zones have no matching records.</p><button type="button" className="paver-action" onClick={() => { setPanel('photos'); setPhotoId(null); }}>Explore the photo pilot ↗</button></>}</aside>
      </div> : <div id="photo-panel" role="tabpanel" aria-labelledby="photo-tab">{selected?.photoSampleId && <p className="paver-photo-link-note">Showing a photographed inscription for <strong>{purchaserName(selected)}</strong>. CSV zone: <strong>{selected.zone}</strong> (unverified).</p>}<TerracePavers focusSampleId={photoId} /></div>}
    </div>
    <div ref={resultTop} className="paver-result-heading" style={{ scrollMarginTop: 20 }}><div><h2>Inscription records</h2><p role="status">{filtered.length.toLocaleString()} {filtered.length === 1 ? 'record' : 'records'}{zone !== 'all' ? ` in reported zone ${zone}` : ''}{query ? ` matching “${query}”` : ''} · {filtered.length ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filtered.length)} shown` : 'no matches'}</p></div><span>Purchaser names may differ from names on the stone.</span></div>
    {!filtered.length ? <div className="paver-empty"><h3>No matching records</h3><p>Try fewer words, switch to “Inscription & purchaser,” or clear the zone and size filters. Only the supplied CSV is searched.</p></div> : <div className="paver-record-grid">{visible.map((record) => <article key={record.id} className={`paver-record${selected?.id === record.id ? ' is-selected' : ''}`}><div className="paver-record-meta"><span>{record.size.replace('x', ' × ')} in.</span><span>Reported zone <strong>{record.zone}</strong></span></div><pre>{record.lines.some(Boolean) ? record.lines.join('\n') : 'No inscription text supplied'}</pre><p>Purchaser: <strong>{purchaserName(record)}</strong></p><div className="paver-record-actions"><button type="button" onClick={() => { setSelected(record); setPanel('zones'); mapTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>Highlight zone {record.zone} ↗</button>{record.photoSampleId && <button type="button" className="paver-photo-action" onClick={() => showPhoto(record)}>View photographed paver ↗</button>}</div></article>)}</div>}
    {pages > 1 && <nav className="paver-pagination" aria-label="Record pages"><button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); resultTop.current?.scrollIntoView({ block: 'start' }); }}>← Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage === pages - 1} onClick={() => { setPage(currentPage + 1); resultTop.current?.scrollIntoView({ block: 'start' }); }}>Next →</button></nav>}
    <details className="paver-reference"><summary>Supplied reference map, source files & limitations</summary><p>The vendor map predates restoration. The CSV zone assignments were supplied separately and remain unverified. No individual paver coordinates are available in the CSV. Photo links are based on five manually reviewed inscription matches and do not establish a crosswalk between the old map and current locations.</p><p>Source wording and apparent date/character problems are retained. The legacy CSV is decoded as Mac Roman for this import; unusual characters should be checked against the original record or stone.</p><a href={asset('pavermap-reference.png')} target="_blank" rel="noreferrer"><img loading="lazy" src={asset('pavermap-reference.png')} alt="Supplied pre-restoration vendor map with red and blue pavers and zones A1 through F6" /><span>Open original reference map ↗</span></a><p><a href={asset('pavers.csv')} download>Download original CSV ↗</a></p></details>
  </div>;
}
