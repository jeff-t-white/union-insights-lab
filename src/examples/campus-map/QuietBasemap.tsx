import { useLayoutEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { Map, NavigationControl, FullscreenControl, GeolocateControl, setWorkerUrl, type GeoJSONSourceSpecification } from 'maplibre-gl';
import buildingLabels from './building-labels.json';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

// Keep the basemap separate from React's dining overlays. Both use flat Mercator.
export function QuietBasemap({ center, zoom, width, height, shell, onReady, onViewChange, onMovementChange, onError }: {
  center: [number, number]; zoom: number; width: number; height: number;
  shell: RefObject<HTMLDivElement | null>;
  onReady: (map: Map, overlayRoot: HTMLElement) => void;
  onViewChange: (center: [number, number], zoom: number) => void;
  onMovementChange: (moving: boolean) => void;
  onError: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const initialView = useRef({ center, zoom });
  const callbacks = useRef({ onReady, onViewChange, onMovementChange, onError });
  callbacks.current = { onReady, onViewChange, onMovementChange, onError };

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
        interactive: true,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        minZoom: 11,
        maxZoom: 17,
        clickTolerance: 5,
        attributionControl: false,
        renderWorldCopies: false,
        maxPitch: 0,
        fadeDuration: 0,
      });
    } catch {
      callbacks.current.onError();
      return;
    }
    map.current = instance;
    instance.on('error', () => callbacks.current.onError());
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();
    instance.addControl(new FullscreenControl({ container: shell.current ?? element.current.closest<HTMLElement>('.map-shell') ?? undefined }), 'top-right');
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, fitBoundsOptions: { maxZoom: 17 } }), 'top-right');
    instance.on('movestart', () => callbacks.current.onMovementChange(true));
    instance.on('moveend', () => callbacks.current.onMovementChange(false));
    // Sync the React overlays to the camera actually drawn this frame, including inertia.
    instance.on('render', () => {
      const position = instance.getCenter();
      flushSync(() => callbacks.current.onViewChange([position.lng, position.lat], instance.getZoom() + 1));
    });
    callbacks.current.onReady(instance, instance.getCanvasContainer());
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

  }, [width, height]);

  return <div ref={element} className="quiet-basemap" aria-label="Interactive campus map" />;
}
