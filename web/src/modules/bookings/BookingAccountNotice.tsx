import { Link } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';

// Auth owns verification and role assignment; Booking only reads its result.
export function BookingAccountNotice({ driverView = false }: { driverView?: boolean }) {
  const { profile, profileLoading, refreshProfile } = useSession();
  if (!profile) return null;
  const ready = driverView ? profile.eligibility.canDrive : profile.eligibility.canBook;
  if (ready) return null;
  const missingVehicle = !profile.vehicleModel?.trim() || !profile.vehiclePlate?.trim();
  const message = profile.studentVerificationStatus !== 'VERIFIED'
    ? 'Hệ thống chưa xác minh hồ sơ sinh viên của bạn. Hãy kiểm tra hồ sơ và tải lại trạng thái sau khi lưu.'
    : driverView && missingVehicle
      ? 'Để nhận khách, hãy hoàn thiện hồ sơ tài xế với loại xe và biển số tại trang Tài khoản.'
      : driverView
        ? 'Hệ thống chưa xác nhận quyền tài xế của bạn. Hãy kiểm tra hồ sơ và tải lại trạng thái sau khi lưu.'
        : 'Tài khoản hiện chưa đủ điều kiện gửi yêu cầu đi cùng.';
  return <aside className="notice" aria-label="Điều kiện tài khoản Booking">
    <p>{message}</p>
    <p>Hệ thống của nhóm tự xác minh và cấp quyền tài xế khi hồ sơ đáp ứng điều kiện. Bạn vẫn có thể xem các yêu cầu đã có.</p>
    <div className="booking-actions">
      <Link className="button secondary" to="/tai-khoan">Kiểm tra hồ sơ</Link>
      <button type="button" className="button secondary" disabled={profileLoading} onClick={refreshProfile}>
        {profileLoading ? 'Đang tải trạng thái…' : 'Tải lại trạng thái tài khoản'}
      </button>
    </div>
  </aside>;
}
