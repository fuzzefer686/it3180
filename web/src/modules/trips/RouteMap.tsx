import { useEffect, useRef, useState } from 'react';
import type { Map as VietmapMap } from '@vietmap/vietmap-gl-js';
import type { RouteStop } from '../../../../shared/contracts';
import type { RouteSnapshot } from '../../../../shared/trips';
import { decodeTripPolyline } from '../../../../shared/trip-polyline';
import * as vietmap from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';

export function RouteMap({ stops, route }: { stops: RouteStop[]; route: RouteSnapshot }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const mapKey = import.meta.env.VITE_VIETMAP_MAP_KEY?.trim();
  useEffect(() => {
    let active = true;
    let map: VietmapMap | null = null;
    setError('');
    setLoading(true);
    function drawMap() {
      if (!mapKey || !container.current) return;
      try {
        if (!active || !container.current) return;
        map = new vietmap.Map({
          container: container.current,
          style: 'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=' + encodeURIComponent(mapKey),
          center: [stops[0].longitude, stops[0].latitude],
          zoom: 12,
        });
        map.addControl(new vietmap.NavigationControl());
        map.on('error', () => {
          if (active) {
            setError('Không tải được bản đồ VietMap. Bạn vẫn có thể xem thông tin tuyến bên dưới.');
            setLoading(false);
          }
        });
        map.on('load', () => {
          if (!active || !map) return;
          try {
            const bounds = new vietmap.LngLatBounds();
            for (let i = 0; i < route.segments.length; i++) {
              const coordinates = decodeTripPolyline(route.segments[i].encodedPolyline);
              for (const coordinate of coordinates) bounds.extend(coordinate);
              const id = 'trip-segment-' + i;
              map.addSource(id, {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
              });
              map.addLayer({ id, source: id, type: 'line',
                paint: { 'line-color': '#08745b', 'line-width': 5 } });
            }
            for (const stop of stops) {
              const marker = document.createElement('span');
              marker.className = 'trip-map-marker';
              marker.textContent = String.fromCharCode(65 + stop.order);
              marker.title = stop.label;
              new vietmap.Marker({ element: marker }).setLngLat([stop.longitude, stop.latitude]).addTo(map);
            }
            map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 });
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
    }
    drawMap();
    return () => {
      active = false;
      if (map) map.remove();
    };
  }, [mapKey, stops, route]);
  if (!mapKey) return <p className="notice">Bản đồ chưa được cấu hình. Thông tin các điểm dừng vẫn hiển thị bên dưới.</p>;
  return <div>
    {loading && <p role="status">Đang tải bản đồ…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div ref={container} className="trip-map" aria-label="Bản đồ tuyến xe máy" />
  </div>;
}
