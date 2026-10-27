import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TripDetails } from '../../../../shared/trips';

interface TripOwnerActionsProps {
  trip: TripDetails;
  canDrive: boolean;
  busy: boolean;
  onStatusChange: (action: 'start' | 'complete' | 'cancel', reason?: string) => Promise<void>;
}

export function TripOwnerActions({ trip, canDrive, busy, onStatusChange }: TripOwnerActionsProps) {
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');

  if (trip.status !== 'OPEN' && trip.status !== 'IN_PROGRESS') return null;

  return <div className="trip-panel">
    <h2>Quản lý chuyến</h2>
    <p className="trip-muted">Bạn là tài xế đăng chuyến này. Cập nhật trạng thái đúng thời điểm thực tế.</p>
    <div className="trip-actions">
      {trip.status === 'OPEN' && <>
        <button className="button primary" type="button" disabled={busy || !canDrive} onClick={() => void onStatusChange('start')}>
          Bắt đầu chuyến
        </button>
        {canDrive && !trip.confirmedBookingId && !trip.hasServedPassenger && !busy && (
          <Link className="button secondary" to={'/chuyen-di/' + trip.id + '/sua'}>Sửa chuyến</Link>
        )}
        <button className="button danger-outline" type="button" disabled={busy} onClick={() => setShowCancel(true)}>
          Hủy chuyến
        </button>
      </>}
      {trip.status === 'IN_PROGRESS' && (
        <button className="button primary" type="button" disabled={busy} onClick={() => void onStatusChange('complete')}>
          Kết thúc chuyến
        </button>
      )}
    </div>
    {trip.status === 'OPEN' && !canDrive && (
      <p className="notice">
        Hồ sơ hiện chưa đủ điều kiện để sửa hoặc bắt đầu chuyến. <Link to="/tai-khoan">Xem hồ sơ</Link>
      </p>
    )}
    {showCancel && (
      <form className="trip-field" onSubmit={async event => {
        event.preventDefault();
        await onStatusChange('cancel', reason);
        if (reason.trim()) setShowCancel(false);
      }}>
        <label className="trip-field">
          <span>Lý do hủy</span>
          <textarea required maxLength={500} placeholder="Ghi rõ lý do để minh bạch lịch sử chuyến…" value={reason} disabled={busy}
            onChange={event => setReason(event.target.value)} />
        </label>
        <div className="trip-actions">
          <button className="button danger-outline" type="submit" disabled={busy}>Xác nhận hủy</button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => setShowCancel(false)}>Giữ chuyến</button>
        </div>
      </form>
    )}
  </div>;
}
