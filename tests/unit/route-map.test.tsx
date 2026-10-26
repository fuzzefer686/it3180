// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeTripPolyline } from '../../shared/trip-polyline';
import type { RouteStop } from '../../shared/contracts';
import type { RouteSnapshot, TripDetails } from '../../shared/trips';
import { profileFixture } from '../fixtures/auth';

const mapMocks = vi.hoisted(() => {
  const listeners = new Map<string, Array<(event?: unknown) => void>>();
  const instances: Array<{
    options: Record<string, unknown>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
  }> = [];
  const extendedCoords: Array<[number, number]> = [];
  const addedMarkers: Array<{ element: HTMLElement; lngLat: [number, number] }> = [];

  class MockMap {
    options: Record<string, unknown>;
    addControl = vi.fn();
    addSource = vi.fn();
    addLayer = vi.fn();
    fitBounds = vi.fn();
    remove = vi.fn();
    resize = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      listeners.clear();
      instances.push(this);
    }
    on(event: string, handler: (payload?: unknown) => void) {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    }
  }

  class MockLngLatBounds {
    extend(coord: [number, number]) {
      extendedCoords.push(coord);
      return this;
    }
  }

  class MockMarker {
    element: HTMLElement;
    lngLat: [number, number] = [0, 0];
    constructor({ element }: { element: HTMLElement }) {
      this.element = element;
    }
    setLngLat(coord: [number, number]) {
      this.lngLat = coord;
      return this;
    }
    addTo() {
      addedMarkers.push({ element: this.element, lngLat: this.lngLat });
      return this;
    }
  }

  return {
    MockMap,
    MockNavigationControl: class {},
    MockLngLatBounds,
    MockMarker,
    listeners,
    instances,
    extendedCoords,
    addedMarkers,
    emit(event: string, payload?: unknown) {
      for (const fn of listeners.get(event) ?? []) fn(payload);
    },
    reset() {
      listeners.clear();
      instances.length = 0;
      extendedCoords.length = 0;
      addedMarkers.length = 0;
    },
  };
});

const appMocks = vi.hoisted(() => ({ api: vi.fn(), session: vi.fn() }));

vi.mock('@vietmap/vietmap-gl-js/dist/vietmap-gl.css', () => ({}));
vi.mock('@vietmap/vietmap-gl-js/dist/vietmap-gl.js', () => ({
  Map: mapMocks.MockMap,
  NavigationControl: mapMocks.MockNavigationControl,
  LngLatBounds: mapMocks.MockLngLatBounds,
  Marker: mapMocks.MockMarker,
}));
vi.mock('../../web/src/lib/callable', async () => ({ callFunction: appMocks.api, ...await import('../../web/src/lib/errors') }));
vi.mock('../../web/src/modules/auth/SessionProvider', () => ({ useSession: appMocks.session }));

import { RouteMap } from '../../web/src/modules/trips/RouteMap';
import { TripDetailPage } from '../../web/src/modules/trips/TripDetailPage';

const sampleStops: RouteStop[] = [
  { id: 'stop-a', order: 0, label: 'ĐH Bách Khoa Hà Nội', latitude: 21.0075, longitude: 105.8427, distanceFromStartMeters: 0 },
  { id: 'stop-b', order: 1, label: 'Bến xe Giáp Bát', latitude: 20.981, longitude: 105.8411, distanceFromStartMeters: 4200 },
  { id: 'stop-c', order: 2, label: 'Bến xe Ninh Bình', latitude: 20.2506, longitude: 105.9759, distanceFromStartMeters: 89744 },
];

const samplePolyline = encodeTripPolyline([
  [105.8427, 21.0075],
  [105.8411, 20.981],
  [105.9759, 20.2506],
]);

const sampleRoute: RouteSnapshot = {
  provider: 'VIETMAP',
  vehicleType: 'MOTORCYCLE',
  encodedPolyline: samplePolyline,
  totalDistanceMeters: 89744,
  totalDurationMs: 10200000,
  segments: [
    { fromStopId: 'stop-a', toStopId: 'stop-b', distanceMeters: 4200, durationMs: null },
    { fromStopId: 'stop-b', toStopId: 'stop-c', distanceMeters: 85544, durationMs: null },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mapMocks.reset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('RouteMap & TripDetailPage VietMap kiểm thử chuyên sâu', () => {
  it('hiển thị thông báo rõ ràng và không khởi tạo WebGL Map khi thiếu VITE_VIETMAP_MAP_KEY', () => {
    vi.stubEnv('VITE_VIETMAP_MAP_KEY', '');
    render(<RouteMap stops={sampleStops} route={sampleRoute} />);
    expect(screen.getByText(/Bản đồ chưa được cấu hình/)).toBeTruthy();
    expect(mapMocks.instances).toHaveLength(0);
  });

  it('vẽ tuyến 2 lớp, gắn marker A/B/C, mở rộng khung bao gồm điểm dừng, highlight không tạo lại Map và dọn dẹp khi unmount', () => {
    vi.stubEnv('VITE_VIETMAP_MAP_KEY', 'map key#demo');
    const view = render(<RouteMap stops={sampleStops} route={sampleRoute} highlightOrders={[0, 2]} />);

    expect(mapMocks.instances).toHaveLength(1);
    const mapInstance = mapMocks.instances[0];
    expect(String(mapInstance.options.style)).toContain('apikey=map%20key%23demo');

    act(() => {
      mapMocks.emit('error', { error: { name: 'AbortError' } });
    });
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => {
      mapMocks.emit('load');
    });

    expect(mapInstance.addSource).toHaveBeenCalledWith('trip-route', expect.objectContaining({ type: 'geojson' }));
    expect(mapInstance.addLayer).toHaveBeenCalledTimes(2);
    expect(mapMocks.addedMarkers.map(m => m.element.textContent)).toEqual(['A', 'B', 'C']);
    expect(mapMocks.extendedCoords).toHaveLength(6);
    expect(mapMocks.addedMarkers[0].element.classList.contains('highlighted')).toBe(true);
    expect(mapMocks.addedMarkers[1].element.classList.contains('highlighted')).toBe(false);
    expect(mapMocks.addedMarkers[2].element.classList.contains('highlighted')).toBe(true);

    view.rerender(<RouteMap stops={sampleStops} route={sampleRoute} highlightOrders={[1, 2]} />);
    expect(mapMocks.instances).toHaveLength(1);
    expect(mapMocks.addedMarkers[0].element.classList.contains('highlighted')).toBe(false);
    expect(mapMocks.addedMarkers[1].element.classList.contains('highlighted')).toBe(true);
    expect(mapMocks.addedMarkers[2].element.classList.contains('highlighted')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Căn lại bản đồ/ }));
    expect(mapInstance.fitBounds).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
  });

  it('báo lỗi an toàn khi polyline hỏng mà không làm sập trang', () => {
    vi.stubEnv('VITE_VIETMAP_MAP_KEY', 'valid-key');
    render(<RouteMap stops={sampleStops} route={{ ...sampleRoute, encodedPolyline: '~~~invalid~~~' }} />);
    act(() => {
      mapMocks.emit('load');
    });
    expect(screen.getByRole('alert').textContent).toContain('Không vẽ được tuyến đường');
  });

  it('TripDetailPage tính lại khoảng cách chặng và cập nhật highlight trên bản đồ khi đổi điểm đón/trả', async () => {
    vi.stubEnv('VITE_VIETMAP_MAP_KEY', 'valid-key');
    const tripFixture: TripDetails = {
      id: 'trip-1',
      driverId: 'driver-1',
      driverName: 'Tài xế Minh',
      status: 'OPEN',
      vehicleType: 'MOTORCYCLE',
      departureTimeMs: Date.now() + 7200000,
      arrivalTimeMs: Date.now() + 14400000,
      note: 'Có sẵn mũ bảo hiểm phụ',
      stops: sampleStops,
      route: sampleRoute,
      routeVersion: 1,
      confirmedBookingId: null,
      hasServedPassenger: false,
      cancellationReason: null,
    };

    appMocks.session.mockReturnValue({
      user: { id: profileFixture.uid },
      loading: false,
      profileLoading: false,
      profile: profileFixture,
    });
    appMocks.api.mockImplementation(async (name: string, input: { pickupStopId?: string; dropoffStopId?: string }) => {
      if (name === 'getTrip') return { trip: tripFixture, isOwner: false };
      if (name === 'getTripSegmentDistance') {
        if (input.pickupStopId === 'stop-a' && input.dropoffStopId === 'stop-c') return { distanceMeters: 89744 };
        if (input.pickupStopId === 'stop-b' && input.dropoffStopId === 'stop-c') return { distanceMeters: 85544 };
      }
      throw new Error('Unexpected API: ' + name);
    });

    render(
      <MemoryRouter initialEntries={['/chuyen-di/trip-1']}>
        <Routes>
          <Route path="/chuyen-di/:tripId" element={<TripDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tài xế Minh')).toBeTruthy();
    await waitFor(() => expect(mapMocks.instances).toHaveLength(1));
    act(() => {
      mapMocks.emit('load');
    });
    await waitFor(() => expect(screen.getAllByText('89,74 km').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Điểm đón'), { target: { value: '1' } });
    await waitFor(() => expect(screen.getByText('427.720 điểm')).toBeTruthy());
    expect(mapMocks.addedMarkers[1].element.classList.contains('highlighted')).toBe(true);
    expect(mapMocks.addedMarkers[2].element.classList.contains('highlighted')).toBe(true);
  });
});
