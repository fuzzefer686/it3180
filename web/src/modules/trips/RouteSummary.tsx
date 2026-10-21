import type { RouteStop } from '../../../../shared/contracts';
import type { RouteSnapshot } from '../../../../shared/trips';
import { distanceText } from './format';

export function RouteSummary({ stops, route }: { stops: RouteStop[]; route: RouteSnapshot }) {
  return <div className="trip-route-summary">
    <p><strong>{distanceText(route.totalDistanceMeters)}</strong> · khoảng {Math.ceil(route.totalDurationMs / 60000)} phút đi xe máy</p>
    <ol className="trip-stops">
      {stops.map(stop => <li key={stop.id}>
        <strong>{String.fromCharCode(65 + stop.order)}. {stop.label}</strong>
        <span>{distanceText(stop.distanceFromStartMeters)} từ điểm đầu</span>
      </li>)}
    </ol>
    <div className="trip-table-scroll">
      <table><caption>Khoảng cách từng đoạn</caption><thead><tr><th>Đoạn</th><th>Khoảng cách</th></tr></thead>
        <tbody>{route.segments.map((segment, index) => <tr key={segment.fromStopId}>
          <td>{String.fromCharCode(65 + index)} → {String.fromCharCode(66 + index)}</td>
          <td>{distanceText(segment.distanceMeters)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
