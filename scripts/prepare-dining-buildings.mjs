import { readFile, writeFile } from 'node:fs/promises';

// Building names are matched explicitly against the OSM snapshot; no fuzzy geocoding.
const entries = [
  ['Memorial Union', '800 Langdon Street', ['Der Rathskeller', 'Der Stiftskeller', 'Strada', 'Carte', "Peet’s Coffee", 'Daily Scoop', 'Badger Market', 'Lakeview Lounge', 'The Brat Stand', 'BBQ Stand', 'Terrace Pop-Up Store']],
  ['Union South', '1308 West Dayton Street', ['Sett Pub', 'Sett Recreation', 'Prairie Fire', 'Naan Stop South', 'Daily Scoop', 'South Cantina', 'Ginger Root', 'Badger Market']],
  ['Levy Hall', '232 North Park Street', ['Hosto Cafe']],
  ['Morgridge Hall', '1205 University Avenue', ['Ground Truth']],
  ['Signe Skott Cooper Hall', '701 Highland Avenue', ['Revive']],
  ['Wisconsin Institute for Discovery', '330 North Orchard Street', ['Pedone Pinsa']],
  ['Helen C. White Hall', '600 North Park Street', ['Open Book Café']],
  ['Microbial Sciences Building', '1550 Linden Drive', ['Microcosm Café']],
  ['Engineering Hall', '1415 Engineering Drive', ['Badger Market']],
  ['Education Building', '1000 Bascom Mall', ['Crossroads Café']],
  ['Veterinary Medicine North', '515 Easterday Lane', ['Badger Market']],
  ['Medical Sciences', '1300 University Avenue (Charter Street entrance)', ['Badger Market', 'Naan Stop Express']],
  ['Ingraham Hall', '1155 Observatory Drive', ['Badger Market']],
  ['Health Sciences Learning Center', '750 Highland Avenue', ['Badger Market']],
  ['Nancy Nicholas Hall', '1300 Linden Drive', ["Robin’s Nest"]],
  ['Fluno Center', '601 University Avenue', ['Oros Executive Dining Room', "Smitty’s Study Pub"]],
  ['Chazen Museum of Art', '750 University Avenue', ['Chazen Café']],
];
const source = JSON.parse(await readFile('src/examples/campus-map/buildings-source.json', 'utf8'));
const ordering = JSON.parse(await readFile('src/examples/campus-map/mobile-ordering.json', 'utf8'));
const buildings = entries.map(([name, address, outlets]) => {
  const entry = source.elements.find((item) => item.tags.name === name);
  if (!entry) throw new Error(`Missing footprint: ${name}`);
  // Local correction from Wisconsin Union staff: Memorial Union does not have
  // the courtyard implied by this OSM relation's inner ring. Keep its exterior
  // footprint; the Terrace remains outdoor space outside that perimeter.
  const geometryNote = name === 'Memorial Union'
    ? 'Inner cutout omitted per Wisconsin Union staff correction. Exterior outline retained; Terrace is outdoor space north of the building.'
    : undefined;
  const rings = entry.geometry ? [entry.geometry] : entry.members.filter((member) => member.type === 'way' && member.geometry && (!geometryNote || member.role === 'outer')).sort((a, b) => (a.role === 'inner') - (b.role === 'inner')).map((member) => member.geometry);
  if (!rings.length || rings.some((ring) => ring[0].lat !== ring.at(-1).lat || ring[0].lon !== ring.at(-1).lon)) throw new Error(`Unclosed footprint: ${name}`);
  const enrichedOutlets = outlets.map((outlet) => {
    const mobile = ordering.locations.find((location) => location.building === name && location.previousName === outlet);
    return mobile
      ? { name: mobile.name, logoPath: mobile.logoPath, sourceUrl: ordering.source, orderUrl: mobile.orderUrl }
      : { name: outlet, logoPath: null, sourceUrl: 'https://union.wisc.edu/dine/find-food-and-drink', orderUrl: null };
  });
  return { id: `${entry.type}/${entry.id}`, name, address, outlets: enrichedOutlets, ...(geometryNote ? { geometryNote } : {}), rings: rings.map((ring) => ring.map(({ lon, lat }) => [lon, lat])) };
});
await writeFile('src/examples/campus-map/dining-buildings.json', JSON.stringify({ checked: '2026-10-09', source: 'https://union.wisc.edu/dine/find-food-and-drink', geometrySource: 'https://www.openstreetmap.org/copyright', buildings }, null, 2));
console.log(`Prepared ${buildings.length} footprints and ${buildings.reduce((sum, building) => sum + building.outlets.length, 0)} directory entries.`);
