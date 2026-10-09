import { useLayoutEffect, useRef } from 'react';
import { Map, setWorkerUrl, type GeoJSONSourceSpecification } from 'maplibre-gl';
import buildingLabels from './building-labels.json';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

// Keep the basemap separate from React's dining overlays. Both use flat Mercator.
export function QuietBasemap({ center, zoom, width, height, onError }: {
  center: [number, number]; zoom: number; width: number; height: number; onError: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const initialView = useRef({ center, zoom });
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useLayoutEffect(() => {
    if (!element.current) return;
    let instance: Map;
    try {
      instance = new Map({
        container: element.current,
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: initialView.current.center,
        // MapLibre uses a 512px world tile; our D3 projection uses 256px.
        zoom: initialView.current.zoom - 1,
        interactive: false,
        attributionControl: false,
        renderWorldCopies: false,
        maxPitch: 0,
        fadeDuration: 0,
      });
    } catch {
      errorHandler.current();
      return;
    }
    map.current = instance;
    instance.on('error', () => errorHandler.current());
    instance.on('style.load', () => {
      const contextLabels = new Set(['water_name_point_label', 'water_name_line_label', 'highway-name-minor', 'highway-name-major']);
      for (const layer of instance.getStyle().layers) {
        if (layer.type === 'symbol' && !contextLabels.has(layer.id)) instance.removeLayer(layer.id);
        if (layer.type === 'fill' && layer['source-layer'] === 'water') instance.setPaintProperty(layer.id, 'fill-color', '#c6dce6');
      }
      instance.addSource('campus-building-names', {
        type: 'geojson', data: buildingLabels as GeoJSONSourceSpecification['data'],
      });
      instance.addLayer({
        id: 'campus-building-names', type: 'symbol', source: 'campus-building-names', minzoom: 14,
        layout: {
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 17, 12],
          'text-max-width': 12, 'text-padding': 8,
          'text-allow-overlap': false, 'text-ignore-placement': false,
        },
        paint: { 'text-color': '#626765', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
      });
      instance.setProjection({ type: 'mercator' });
    });
    return () => { map.current = null; instance.remove(); };
  }, []);

  useLayoutEffect(() => {
    const instance = map.current;
    if (!instance || !width || !height) return;
    instance.resize();
    instance.jumpTo({ center, zoom: zoom - 1, bearing: 0, pitch: 0 });
    // Draw before the browser paints the updated React markers, preventing drag lag.
    instance.redraw();
  }, [center, zoom, width, height]);

  return <div ref={element} className="quiet-basemap" aria-hidden="true" />;
}
