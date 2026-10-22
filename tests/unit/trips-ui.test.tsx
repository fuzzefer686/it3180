// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripFormPage } from '../../web/src/modules/trips/TripFormPage';
import { BookingsPage } from '../../web/src/modules/bookings/BookingsPage';
import { profileFixture } from '../fixtures/auth';
import { toVietnamInput } from '../../web/src/modules/trips/format';
import { TripError } from '../../shared/trip-errors';

const mocks = vi.hoisted(() => ({ api: vi.fn(), session: vi.fn() }));
vi.mock('../../web/src/lib/callable', async () => ({ callFunction: mocks.api, ...await import('../../web/src/lib/errors') }));
vi.mock('../../web/src/modules/auth/SessionProvider', () => ({ useSession: mocks.session }));
vi.mock('../../web/src/modules/trips/RouteMap', () => ({ RouteMap: () => <div>Bản đồ kết quả</div> }));

const places = [
  { label: 'Điểm A demo', latitude: 21.01, longitude: 105.81 },
  { label: 'Điểm B demo', latitude: 21.02, longitude: 105.82 },
];
const preview = {
  stops: places.map((place, order) => ({ ...place, id: 'stop-' + order, order, distanceFromStartMeters: order * 1200 })),
  route: { encodedPolyline: 'demo', provider: 'VIETMAP', vehicleType: 'MOTORCYCLE', totalDistanceMeters: 1200, totalDurationMs: 90000,
    segments: [{ fromStopId: 'stop-0', toStopId: 'stop-1', distanceMeters: 1200, durationMs: 90000, encodedPolyline: 'demo' }] },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockReturnValue({ user: { id: profileFixture.uid }, loading: false, profileLoading: false,
    profile: { ...profileFixture, roles: ['USER', 'DRIVER'], eligibility: { canBook: true, canDrive: true } } });
  mocks.api.mockImplementation(async (name: string, input: { text?: string; refId?: string }) => {
    if (name === 'searchTripPlaces') return { items: [{ refId: input.text, label: 'Chọn điểm ' + input.text }] };
    if (name === 'getTripPlace') return { place: input.refId === 'aa' ? places[0] : places[1] };
    if (name === 'previewTripRoute') return preview;
    if (name === 'createTrip') return { trip: { id: 'saved-trip' } };
    throw new Error('Unexpected API: ' + name);
  });
});
afterEach(cleanup);
function mount() {
  return render(<MemoryRouter initialEntries={['/chuyen-di/dang']}><Routes>
    <Route path="/chuyen-di/dang" element={<TripFormPage />} />
    <Route path="/chuyen-di/saved-trip" element={<p>Đã mở chuyến vừa lưu</p>} />
  </Routes></MemoryRouter>);
}
async function selectStops() {
  for (const [label, text] of [['A. Điểm dừng', 'aa'], ['B. Điểm dừng', 'bb']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn điểm ' + text }));
  }
  await waitFor(() => expect(screen.getAllByText('Đã chọn địa điểm.')).toHaveLength(2));
}

describe('Frontend Trip kết hợp hồ sơ Auth', () => {
  it('role DRIVER chưa đủ: canDrive=false phải chặn form và không gọi API bản đồ', () => {
    mocks.session.mockReturnValue({ user: { id: profileFixture.uid }, loading: false, profileLoading: false,
      profile: { ...profileFixture, roles: ['USER', 'DRIVER'] } });
    mount();
    expect(screen.getByRole('link', { name: 'Hoàn thiện hồ sơ' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lưu chuyến' })).toBeNull();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it('chọn địa điểm → xem trước → lưu chỉ gửi input của form → mở chi tiết', async () => {
    mount();
    await selectStops();
    fireEvent.click(screen.getByRole('button', { name: 'Xem trước tuyến' }));
    expect(await screen.findByText('Bản đồ kết quả')).toBeTruthy();
    expect(mocks.api).toHaveBeenCalledWith('previewTripRoute', { stops: places });
    const departure = toVietnamInput(Date.now() + 3600000);
    const arrival = toVietnamInput(Date.now() + 7200000);
    fireEvent.change(screen.getByLabelText('Giờ đi (giờ Việt Nam)'), { target: { value: departure } });
    fireEvent.change(screen.getByLabelText('Giờ đến dự kiến (giờ Việt Nam)'), { target: { value: arrival } });
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: '  Demo  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chuyến' }));
    expect(await screen.findByText('Đã mở chuyến vừa lưu')).toBeTruthy();
    expect(mocks.api).toHaveBeenCalledWith('createTrip', {
      stops: places, departureTimeMs: Date.parse(departure + ':00+07:00'),
      arrivalTimeMs: Date.parse(arrival + ':00+07:00'), note: 'Demo',
    });
  });

  it('VietMap lỗi thì hiện thông báo, mở lại nút và giữ các điểm đã chọn', async () => {
    mount();
    await selectStops();
    mocks.api.mockRejectedValueOnce(new TripError('MAP_UNAVAILABLE', 'VietMap chưa phản hồi được.'));
    fireEvent.click(screen.getByRole('button', { name: 'Xem trước tuyến' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'VietMap chưa phản hồi được.');
    expect(screen.queryByText('Bản đồ kết quả')).toBeNull();
    expect(screen.getAllByText('Đã chọn địa điểm.')).toHaveLength(2);
    expect(screen.getByRole('group').hasAttribute('disabled')).toBe(false);
  });

  it('mục Tôi cầm lái mở danh sách chuyến thật thay cho màn hình chưa sẵn sàng', async () => {
    render(<MemoryRouter initialEntries={['/dat-chuyen']}><Routes>
      <Route path="/dat-chuyen" element={<BookingsPage />} />
      <Route path="/chuyen-di/cua-toi" element={<p>Danh sách chuyến tài xế</p>} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Tôi cầm lái' }));
    expect(await screen.findByText('Danh sách chuyến tài xế')).toBeTruthy();
  });
});
