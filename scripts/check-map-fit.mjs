import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geoMercator } from 'd3';
import { MercatorCoordinate } from 'maplibre-gl';
import { fitDiningView } from '../src/examples/campus-map/fitDiningView.ts';

const data = JSON.parse(await readFile('src/examples/campus-map/campus-dining.json', 'utf8'));
const points = [...data.buildings.flatMap((building) => building.rings.flat()), ...data.locations.map((location) => location.geometry.coordinates)];
for (const [width, height] of [[1800, 700], [1000, 650], [600, 500], [350, 500]]) {
  const view = fitDiningView(points, width, height);
  const projection = geoMercator().scale(256 * 2 ** view.zoom / (2 * Math.PI)).center(view.center).translate([width / 2, height / 2]);
  const padding = width < 600 ? 48 : 64;
  for (const point of points) {
    const [x, y] = projection(point);
    assert(x >= padding - 0.01 && x <= width - padding + 0.01, 'Building outside horizontal padding');
    assert(y >= padding - 0.01 && y <= height - padding + 0.01, 'Building outside vertical padding');
  }
  // MapLibre's world is 512px at zoom zero; D3's is 256px.
  // Verify pixel alignment with the actual MapLibre Mercator coordinate utility.
  const worldSize = 512 * 2 ** (view.zoom - 1);
  const mapCenter = MercatorCoordinate.fromLngLat(view.center);
  for (const point of points) {
    const mapPoint = MercatorCoordinate.fromLngLat(point);
    const screenPoint = projection(point);
    assert(Math.abs((mapPoint.x - mapCenter.x) * worldSize + width / 2 - screenPoint[0]) < 0.000001);
    assert(Math.abs((mapPoint.y - mapCenter.y) * worldSize + height / 2 - screenPoint[1]) < 0.000001);
  }
  console.log(`${width} × ${height}: all footprints and markers fit; MapLibre and D3 align`);
}
