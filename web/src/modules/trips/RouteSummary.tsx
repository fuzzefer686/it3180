import { Clock3, Route } from 'lucide-react';
import type { RouteStop } from '../../../../shared/contracts';
import type { RouteSnapshot } from '../../../../shared/trips';
import { distanceText } from './format';

export function RouteSummary({ stops, route }: { stops: RouteStop[]; route: RouteSnapshot }) {
  const hasSegmentDuration = route.segments.some(segment => segment.durationMs !== null);
  return <div className="trip-route-summary">
    <div className="trip-metrics">
      <span className="trip-metric-pill">
        <Route size={16}/> Tổng lộ trình: <strong>{distanceText(route.totalDistanceMeters)}</strong>
      </span>
      {route.totalDurationMs !== null && (
        <span className="trip-metric-pill">
          <Clock3 size={16}/> Khoảng <strong>{Math.ceil(route.totalDurationMs / 60000)} phút</strong> đi xe máy
        </span>
      )}
    </div>

    <ol className="trip-stops">
      {stops.map(stop => {
        const code = String.fromCharCode(65 + stop.order);
        return <li key={stop.id}>
          <span className="trip-stop-badge" aria-hidden="true">{code}</span>
          <div className="trip-stop-info">
            <strong>{code}. {stop.label}</strong>
            <span>{stop.order === 0 ? 'Điểm xuất phát (0 km)' : `Cách điểm đầu ${distanceText(stop.distanceFromStartMeters)}`}</span>
          </div>
        </li>;
      })}
    </ol>

    <div className="trip-table-scroll">
      <table>
        <caption>Khoảng cách từng đoạn</caption>
        <thead>
          <tr>
            <th>Đoạn</th>
            <th>Khoảng cách</th>
            {hasSegmentDuration && <th>Ước tính</th>}
          </tr>
        </thead>
        <tbody>
          {route.segments.map((segment, index) => (
            <tr key={segment.fromStopId}>
              <td>{String.fromCharCode(65 + index)} → {String.fromCharCode(66 + index)}</td>
              <td>{distanceText(segment.distanceMeters)}</td>
              {hasSegmentDuration && (
                <td>{segment.durationMs !== null ? `${Math.ceil(segment.durationMs / 60000)} phút` : '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>;
}
