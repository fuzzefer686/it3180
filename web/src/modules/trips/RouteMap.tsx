import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Navigation } from 'lucide-react';
import type { Map as VietmapMap } from '@vietmap/vietmap-gl-js';
import type { RouteStop } from '../../../../shared/contracts';
import type { RouteSnapshot } from '../../../../shared/trips';
import { decodeTripPolyline } from '../../../../shared/trip-polyline';
import * as vietmap from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';

interface RouteMapProps {
  stops: RouteStop[];
  route: RouteSnapshot;
  highlightOrders?: [number, number];
}

export function RouteMap({ stops, route, highlightOrders }: RouteMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<VietmapMap | null>(null);
  const boundsRef = useRef<InstanceType<typeof vietmap.LngLatBounds> | null>(null);
  const markersRef = useRef<Map<number, HTMLElement>>(new Map());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const mapKey = import.meta.env.VITE_VIETMAP_MAP_KEY?.trim();

  useEffect(() => {
    let active = true;
    let map: VietmapMap | null = null;
    let observer: ResizeObserver | null = null;
    markersRef.current.clear();
    boundsRef.current = null;
    setError('');
    setReady(false);

    if (!mapKey || !container.current || stops.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      map = new vietmap.Map({
        container: container.current,
        style: 'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=' + encodeURIComponent(mapKey),
        center: [stops[0].longitude, stops[0].latitude],
        zoom: 12,
      });
      mapRef.current = map;
      map.addControl(new vietmap.NavigationControl());

      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => { map?.resize(); });
        observer.observe(container.current);
      }

      map.on('error', (event?: { error?: { name?: string } }) => {
        if (event?.error?.name === 'AbortError') return;
        if (active) {
          setError('Không tải được bản đồ VietMap. Bạn vẫn có thể xem thông tin tuyến bên dưới.');
          setLoading(false);
        }
      });

      map.on('load', () => {
        if (!active || !map) return;
        try {
          const bounds = new vietmap.LngLatBounds();
          const coordinates = decodeTripPolyline(route.encodedPolyline);
          for (const coordinate of coordinates) bounds.extend(coordinate);
          for (const stop of stops) bounds.extend([stop.longitude, stop.latitude]);

          const sourceId = 'trip-route';
          map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
          });
          map.addLayer({
            id: 'trip-route-casing',
            source: sourceId,
            type: 'line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0f4c5c', 'line-width': 8, 'line-opacity': 0.28 },
          });
          map.addLayer({
            id: sourceId,
            source: sourceId,
            type: 'line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0d9488', 'line-width': 5 },
          });

          for (const stop of stops) {
            const marker = document.createElement('span');
            const isEndpoint = stop.order === 0 || stop.order === stops.length - 1;
            marker.className = `trip-map-marker${isEndpoint ? ' endpoint' : ''}`;
            marker.dataset.stopOrder = String(stop.order);
            marker.textContent = String.fromCharCode(65 + stop.order);
            marker.title = `${String.fromCharCode(65 + stop.order)}. ${stop.label}`;
            markersRef.current.set(stop.order, marker);
            new vietmap.Marker({ element: marker }).setLngLat([stop.longitude, stop.latitude]).addTo(map);
          }

          boundsRef.current = bounds;
          map.fitBounds(bounds, { padding: 52, maxZoom: 15, duration: 0 });
          setReady(true);
        } catch {
          setError('Không vẽ được tuyến đường. Bạn vẫn có thể xem thông tin tuyến bên dưới.');
        }
        setLoading(false);
      });
    } catch {
      if (active) {
        setError('Không mở được bản đồ trên trình duyệt này.');
        setLoading(false);
      }
    }

    return () => {
      active = false;
      observer?.disconnect();
      markersRef.current.clear();
      mapRef.current = null;
      boundsRef.current = null;
      if (map) map.remove();
    };
  }, [mapKey, stops, route]);

  useEffect(() => {
    for (const [order, element] of markersRef.current.entries()) {
      const isHighlighted = Boolean(highlightOrders && (order === highlightOrders[0] || order === highlightOrders[1]));
      element.classList.toggle('highlighted', isHighlighted);
    }
  }, [highlightOrders, ready, stops]);

  if (!mapKey) {
    return <p className="notice">Bản đồ chưa được cấu hình. Thông tin các điểm dừng vẫn hiển thị bên dưới.</p>;
  }

  return <div className="trip-map-wrap">
    <div className="trip-map-bar">
      <span className="status-pill teal"><Navigation size={13}/> Tuyến xe máy · VietMap</span>
      {ready && (
        <button type="button" className="button secondary compact" onClick={() => {
          if (mapRef.current && boundsRef.current) {
            mapRef.current.fitBounds(boundsRef.current, { padding: 52, maxZoom: 15, duration: 300 });
          }
        }}>
          <LocateFixed size={14}/> Căn lại bản đồ
        </button>
      )}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="trip-map-frame">
      {loading && <p className="trip-map-loading" role="status">Đang tải bản đồ…</p>}
      <div ref={container} className="trip-map" aria-label="Bản đồ tuyến xe máy" />
    </div>
  </div>;
}
