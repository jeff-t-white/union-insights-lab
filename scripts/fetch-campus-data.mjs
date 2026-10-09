import { writeFile } from 'node:fs/promises';

const query = '[out:json][timeout:45];(way["building"]["name"](43.065,-89.455,43.09,-89.385);relation["name"="Memorial Union"](43.065,-89.455,43.09,-89.385);relation["name"="Medical Sciences Center"](43.065,-89.455,43.09,-89.385);relation["name"~"Veterinary"](43.065,-89.455,43.09,-89.385););out geom;';
const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST', body: new URLSearchParams({ data: query }),
  headers: { 'User-Agent': 'UnionInsightsLab/0.1 (UW-Madison learning project)' },
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Overpass: ${response.status}`);
const data = await response.json();
await writeFile('src/examples/campus-map/buildings-source.json', JSON.stringify(data));
console.log(`Downloaded ${data.elements.length} named footprints.`);
