import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = 'https://www.wisc.edu/dining/';
const htmlPath = process.argv[2];
const html = htmlPath ? await readFile(htmlPath, 'utf8') : await (await fetch(sourceUrl)).text();
// Read only literal data fields; do not execute JavaScript from the source page.
const data = html.match(/var dining_locations=([\s\S]*?)<\/script>/)?.[1];
if (!data) throw new Error('Dining map data not found; review the source format.');
const literal = (text, key) => {
  const match = text.match(new RegExp(`(?:^|,)${key}:("(?:[^"\\\\]|\\\\.)*")`));
  return match ? JSON.parse(match[1]) : null;
};
const matches = [...data.matchAll(/\{type:"Feature",geometry:\{type:"Point",coordinates:\[([^\]]+)\]\},properties:\{([\s\S]*?)\}\}/g)];
const excludedNames = new Set(['Pasta Pronto']);
const features = matches.map((match) => {
  const coordinates = JSON.parse(`[${match[1]}]`);
  const name = literal(match[2], 'name');
  const locationUrl = literal(match[2], 'hours_location_url');
  if (!name || !locationUrl || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) throw new Error('Invalid location record');
  if (coordinates[0] < -89.5 || coordinates[0] > -89.3 || coordinates[1] < 43 || coordinates[1] > 43.2) throw new Error(`Unexpected campus coordinates: ${name}`);
  const host = new URL(locationUrl).hostname;
  const provider = host === 'union.wisc.edu' || host === 'fluno.com' ? 'union' : host === 'www.housing.wisc.edu' ? 'housing' : 'other';
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { name, provider, locationUrl, sourceUrl, coordinateMeaning: 'Published UW dining map marker; not independently surveyed or verified as an exact counter position.' } };
}).filter((feature) => !excludedNames.has(feature.properties.name));
if (!features.length) throw new Error('No campus locations extracted');
const checked = new Date().toISOString().slice(0, 10);
await writeFile('src/examples/campus-map/uw-dining-points.geojson', JSON.stringify({ type: 'FeatureCollection', sourceUrl, checked, features }, null, 2) + '\n');
await writeFile('src/examples/campus-map/campus-dining-points.json', JSON.stringify({ sourceUrl, checked, features }, null, 2) + '\n');
const csvField = (value) => `"${String(value).replaceAll('"', '""')}"`;
const rows = features.map(({ properties, geometry }) => [properties.name, properties.provider, geometry.coordinates[1], geometry.coordinates[0], properties.locationUrl, sourceUrl].map(csvField).join(','));
await writeFile('src/examples/campus-map/uw-dining-coordinates.csv', 'name,provider,latitude,longitude,location_url,coordinate_source\n' + rows.join('\n') + '\n');
console.log(`Extracted ${features.length} campus map points from ${matches.length} total campus dining points.`);
for (const feature of features) console.log(`${feature.properties.name}: ${feature.geometry.coordinates.join(', ')}`);
