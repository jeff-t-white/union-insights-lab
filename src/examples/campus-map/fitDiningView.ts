import { geoMercator } from 'd3';

/** Fit every building footprint, allowing fractional zoom levels between + clicks. */
export function fitDiningView(points: number[][], width: number, height: number) {
  const projection = geoMercator().scale(256 / (2 * Math.PI)).translate([128, 128]);
  const projected = points.map(([longitude, latitude]) => projection([longitude, latitude])!);
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const center = projection.invert!([(minX + maxX) / 2, (minY + maxY) / 2])!;
  // Leave room for map controls and a little context around the outer buildings.
  const padding = width < 600 ? 48 : 64;
  const scale = Math.min(
    Math.max(1, width - 2 * padding) / (maxX - minX),
    Math.max(1, height - 2 * padding) / (maxY - minY),
  );
  return { center, zoom: Math.max(12, Math.min(18, Math.log2(scale))) };
}
