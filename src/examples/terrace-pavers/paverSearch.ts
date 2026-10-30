import data from './paver-records.json';

export type PaverRecord = typeof data.records[number];
export type SearchScope = 'all' | 'inscription' | 'purchaser';
export const records = data.records;
export const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const purchaserName = (record: PaverRecord) => normalize(record.firstName) === normalize(record.lastName) ? record.firstName : `${record.firstName} ${record.lastName}`.trim();
const indexed = records.map((record) => ({ record, inscription: normalize(record.lines.join(' ')), purchaser: normalize(`${record.firstName} ${record.lastName}`) }));

export function searchPavers(query: string, scope: SearchScope, size: string) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  return indexed.filter((item) => {
    const text = scope === 'inscription' ? item.inscription : scope === 'purchaser' ? item.purchaser : `${item.inscription} ${item.purchaser}`;
    return (size === 'all' || item.record.size === size) && tokens.every((token) => text.includes(token));
  }).map((item) => item.record).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.sourceRow - b.sourceRow);
}
