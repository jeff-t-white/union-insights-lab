import { readFile, writeFile } from 'node:fs/promises';
import { geoIdentity, geoPath } from 'd3';
const source = JSON.parse(await readFile('src/examples/campus-map/buildings-source.json', 'utf8'));
const dining = JSON.parse(await readFile('src/examples/campus-map/campus-dining.json', 'utf8'));
const shapes = new Map();
for (const item of source.elements) {
  // The earlier Medical Sciences name match was the small Linden Drive wing.
  if (item.id === 172992066 || !item.tags?.name) continue;
  const exterior = item.geometry ?? item.members?.find((member) => member.role === 'outer' && member.geometry)?.geometry;
  if (!exterior) continue;
  shapes.set(`${item.type}/${item.id}`, { name: item.tags.name, rings: [exterior.map(({ lon, lat }) => [lon, lat])] });
}
// Dining names and corrected geometries take precedence over generic OSM names.
for (const building of dining.buildings) shapes.set(building.id, building);
const path = geoPath(geoIdentity());
const features = [...shapes.entries()].flatMap(([id, building]) => {
  const coordinates = path.centroid({ type: 'Polygon', coordinates: [building.rings[0]] });
  if (!coordinates.every(Number.isFinite)) return [];
  return [{ type: 'Feature', id, properties: { name: building.name }, geometry: { type: 'Point', coordinates } }];
});
await writeFile('src/examples/campus-map/building-labels.json', JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
console.log(`Prepared ${features.length} building-name labels.`);
