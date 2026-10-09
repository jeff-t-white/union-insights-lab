import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geoMercator } from 'd3';
import { fitDiningView } from '../src/examples/campus-map/fitDiningView.ts';

const data = JSON.parse(await readFile('src/examples/campus-map/dining-buildings.json', 'utf8'));
const points = data.buildings.flatMap((building) => building.rings.flat());
for (const [width, height] of [[1800, 700], [1000, 650], [600, 500], [350, 500]]) {
  const view = fitDiningView(points, width, height);
  const projection = geoMercator().scale(256 * 2 ** view.zoom / (2 * Math.PI)).center(view.center).translate([width / 2, height / 2]);
  const padding = width < 600 ? 48 : 64;
  for (const point of points) {
    const [x, y] = projection(point);
    assert(x >= padding - 0.01 && x <= width - padding + 0.01, 'Building outside horizontal padding');
    assert(y >= padding - 0.01 && y <= height - padding + 0.01, 'Building outside vertical padding');
  }
  // A fractional tile grid must place points exactly like the map projection.
  const tileZoom = Math.floor(view.zoom);
  const scale = 2 ** (view.zoom - tileZoom);
  const tileProjection = geoMercator().scale(256 * 2 ** tileZoom / (2 * Math.PI)).translate([128 * 2 ** tileZoom, 128 * 2 ** tileZoom]);
  const tileCenter = tileProjection(view.center);
  for (const point of points) {
    const tilePoint = tileProjection(point);
    const screenPoint = projection(point);
    assert(Math.abs((tilePoint[0] - tileCenter[0]) * scale + width / 2 - screenPoint[0]) < 0.000001);
    assert(Math.abs((tilePoint[1] - tileCenter[1]) * scale + height / 2 - screenPoint[1]) < 0.000001);
  }
  console.log(`${width} × ${height}: zoom ${view.zoom.toFixed(2)}, all footprints fit and tiles align`);
}
