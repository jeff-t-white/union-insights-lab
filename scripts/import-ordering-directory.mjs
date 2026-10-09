import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Input is the rendered public directory HTML, not the JavaScript-only page shell.
const htmlPath = process.argv[2];
if (!htmlPath) throw new Error('Usage: node scripts/import-ordering-directory.mjs <rendered-directory.html>');
const html = await readFile(htmlPath, 'utf8');
const matches = [...html.matchAll(/<button\b[^>]*data-testid="btn-location-(\d+)"[\s\S]*?<\/button>/g)];
const mappings = {
  1969: ['Union South', 'South Cantina'],
  1974: ['Union South', 'Prairie Fire'],
  2147: ['Union South', 'Ginger Root'],
  2148: ['Union South', 'Sett Pub'],
  2157: ['Union South', 'Naan Stop South'],
  1972: ['Memorial Union', 'Peet’s Coffee'],
  1973: ['Memorial Union', 'Lakeview Lounge'],
  2153: ['Memorial Union', 'Strada'],
  2154: ['Memorial Union', 'Carte'],
  2155: ['Memorial Union', 'Der Rathskeller'],
  2150: ['Engineering Hall', 'Badger Market'],
  2146: ['Medical Sciences', 'Badger Market'],
  1975: ['Chazen Museum of Art', 'Chazen Café'],
  2152: ['Microbial Sciences Building', 'Microcosm Café'],
  2151: ['Veterinary Medicine North', 'Badger Market'],
  2156: ['Helen C. White Hall', 'Open Book Café'],
  2149: ['Nancy Nicholas Hall', 'Robin’s Nest'],
  2467: ['Education Building', 'Crossroads Café'],
  2468: ['Morgridge Hall', 'Ground Truth'],
  2466: ['Wisconsin Institute for Discovery', 'Pedone Pinsa'],
  2465: ['Levy Hall', 'Hosto Cafe'],
};
const excludedIds = new Set(['1970', '1971']); // Pasta Pronto (permanently closed); Babcock Dairy Store (not Union).
const decode = (text) => text.replaceAll('&#39;', "'").replaceAll('&amp;', '&').replaceAll('&apos;', "'").replaceAll('&quot;', '"');
await mkdir('public/dining-logos', { recursive: true });
const locations = [];
for (const match of matches) {
  const id = match[1];
  if (excludedIds.has(id)) continue;
  const mapping = mappings[id];
  if (!mapping) throw new Error(`Review unmapped ordering location ${id} before importing.`);
  const name = decode(match[0].match(/<span[^>]*MuiTypography-body1[^>]*>([^<]+)<\/span>/)?.[1] ?? '');
  const logoSource = match[0].match(/srcset="([^"]+)"/)?.[1];
  if (!name || !logoSource?.startsWith('https://hangrybbprod.blob.core.windows.net/campuses/')) throw new Error(`Missing name or official logo for ${id}`);
  const response = await fetch(logoSource);
  if (!response.ok) throw new Error(`Logo download failed for ${name}`);
  // Azure serves these images as application/octet-stream; verify file bytes.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'png' : null;
  if (!extension) throw new Error(`Unexpected logo format for ${name}`);
  const logoPath = `dining-logos/${id}.${extension}`;
  await writeFile(`public/${logoPath}`, bytes);
  locations.push({ id, building: mapping[0], previousName: mapping[1], name, logoPath, logoSource, orderUrl: `https://weborder.transactcampus.com/230/${id}` });
}
if (locations.length !== Object.keys(mappings).length) throw new Error('Directory is incomplete; review before saving.');
await writeFile('src/examples/campus-map/mobile-ordering.json', JSON.stringify({ source: 'https://weborder.transactcampus.com/230', checked: new Date().toISOString().slice(0, 10), excluded: ['Pasta Pronto', 'Babcock Dairy Store'], locations }, null, 2) + '\n');
console.log(`Imported ${locations.length} Union ordering names and logos; excluded Pasta Pronto and Babcock Dairy Store.`);
