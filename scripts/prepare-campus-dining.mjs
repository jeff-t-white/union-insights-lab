import { readFile, writeFile } from 'node:fs/promises';
const read = async (name) => JSON.parse(await readFile(`src/examples/campus-map/${name}`, 'utf8'));
const [union, points, source, mobile] = await Promise.all(['dining-buildings.json', 'campus-dining-points.json', 'buildings-source.json', 'mobile-ordering.json'].map(read));
// Reviewed host-building matches, not nearest-building guesses. Each pair is
// [published map name, earlier Union outlet name] when those names differ.
const groups = {
  'Memorial Union': [['Der Rathskeller','Rathskeller'], 'Der Stiftskeller', 'Strada', 'Carte', ['Peet’s Coffee','Peets Coffee'], ['Daily Scoop at Memorial Union','Daily Scoop'], ['Badger Market at Memorial Union','Badger Market'], 'Lakeview Lounge', ['Brat Stand','The Brat Stand'], 'BBQ Stand'],
  'Union South': [['The Sett Pub','Sett Pub'], ['Sett Rec','Sett Recreation'], ['Prairie Fire Coffeehouse','Prairie Fire'], 'Naan Stop South', ['Daily Scoop at Union South','Daily Scoop'], 'South Cantina', 'Ginger Root', ['Badger Market at Union South','Badger Market']],
  'Morgridge Hall': ['Ground Truth'], 'Signe Skott Cooper Hall': ['Revive'],
  'Helen C. White Hall': [['Open Book Café','Open Book Cafe']],
  'Microbial Sciences Building': [['Microcosm Café','Microcosm Cafe']],
  'Engineering Hall': [['Badger Market at Engineering','Badger Market Engineering']],
  'Education Building': [['Crossroads Café','Crossroads Cafe']],
  'Medical Sciences': [['Badger Market at Medical Sciences','Badger Market Medical Sciences']],
  'Ingraham Hall': [['Badger Market at Ingraham','Badger Market']],
  'Health Sciences Learning Center': [['Badger Market at Health Sciences Learning Center','Badger Market']],
  'Nancy Nicholas Hall': [['Badger Market at School of Human Ecology',"Badger Market Robin's Nest"]],
  'Fluno Center': [['Fluno Center Executive Dining Room','Oros Executive Dining Room'], 'Smitty’s Study Pub'],
  'Chazen Museum of Art': [['Chazen Café','Chazen Cafe']],
  'Carson Gulley Center': ['Carson’s Market'],
  'Dejope Residence Hall': ['Four Lakes Market', 'Flamingo Run at Four Lakes Market', 'The Bean & Creamery at Four Lakes Market'],
  'Gordon Dining and Event Center': ['Gordon Avenue Market', 'Flamingo Run at Gordon Avenue Market'],
  'Waters Residence Hall': ['Liz’s Market'],
  'Chadbourne Residence Hall': ['Rheta’s Market', 'Flamingo Run at Rheta’s Market'],
  'Bakke Recreation & Wellbeing Center': ['Shake Smart'],
  'Smith Residence Hall': ['Starbucks at Smith'],
  'Babcock Hall': ['Babcock Hall Dairy Store'],
  'Wisconsin Institute for Discovery': ['Aldo’s Cafe', 'Steenbock’s on Orchard'],
  'UW Health University Hospital': ['Four Lakes Café (UW Hospital Cafeteria)', 'Java Coast', 'Mendota Market'],
};
const buildings = union.buildings.map((building) => ({ ...building, outlets: building.outlets.map((outlet) => ({ ...outlet, provider: 'union', locationUrl: outlet.sourceUrl })) }));
const locations = structuredClone(points.features);
for (const [buildingName, entries] of Object.entries(groups)) {
  let building = buildings.find((item) => item.name === buildingName);
  if (!building) {
    const element = source.elements.find((item) => item.tags.name === buildingName);
    if (!element?.geometry) throw new Error(`Missing footprint: ${buildingName}`);
    const ring = element.geometry.map(({ lon, lat }) => [lon, lat]);
    if (ring.length < 4 || String(ring[0]) !== String(ring.at(-1))) throw new Error(`Invalid ring: ${buildingName}`);
    building = { id: `${element.type}/${element.id}`, name: buildingName, address: `${element.tags['addr:housenumber']} ${element.tags['addr:street']}`, outlets: [], rings: [ring] };
    buildings.push(building);
  }
  for (const entry of entries) {
    const [sourceName, displayName] = Array.isArray(entry) ? entry : [entry, entry];
    const feature = locations.find((item) => item.properties.name === sourceName);
    if (!feature) throw new Error(`Missing published marker: ${sourceName}`);
    let outlet = building.outlets.find((item) => item.name === displayName);
    if (!outlet) {
      if (feature.properties.provider === 'union') throw new Error(`Unmatched Union outlet: ${displayName}`);
      outlet = { name: displayName, provider: feature.properties.provider, logoPath: null, orderUrl: null, sourceUrl: points.sourceUrl, locationUrl: feature.properties.locationUrl };
      building.outlets.push(outlet);
    }
    // The existing Union directory already applies mobile-ordering name precedence.
    const ordering = mobile.locations.find((item) => item.building === buildingName && item.name === outlet.name);
    Object.assign(feature.properties, { sourceName, name: outlet.name, buildingId: building.id, buildingName, logoPath: ordering?.logoPath ?? outlet.logoPath, orderUrl: ordering?.orderUrl ?? outlet.orderUrl });
    outlet.locationUrl = feature.properties.locationUrl;
  }
}
// Catering is a campus-wide service: preserve its authored point without guessing a host building.
for (const location of locations) {
  if (!('buildingId' in location.properties)) Object.assign(location.properties, { sourceName: location.properties.name, buildingId: null, buildingName: null, logoPath: null, orderUrl: null });
}
// React uses this identity for markers and directory rows; display names may repeat.
const identities = locations.map((location) => location.properties.sourceName);
if (identities.some((id) => !id) || new Set(identities).size !== locations.length) throw new Error('Dining marker identities must be unique');
await writeFile('src/examples/campus-map/campus-dining.json', JSON.stringify({ checked: points.checked, buildings, locations }, null, 2) + '\n');
console.log(`Prepared ${buildings.length} buildings, ${locations.length} markers; ${locations.filter((item) => item.properties.buildingId).length} explicit building matches.`);
