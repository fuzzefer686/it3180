import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../../../../shared/contracts';

type Verification = UserProfile['studentVerificationStatus'];
const verificationLabels: Record<Verification, string> = {
  VERIFIED: 'Đã duyệt', PENDING: 'Chờ duyệt', REJECTED: 'Bị từ chối',
};
const verificationTones: Record<Verification, 'emerald' | 'amber' | 'danger'> = {
  VERIFIED: 'emerald', PENDING: 'amber', REJECTED: 'danger',
};
const roleLabels = { USER: 'Hành khách', DRIVER: 'Tài xế', ADMIN: 'Quản trị viên' };

// Server chỉ trả về đúng/sai; liệt kê điều còn thiếu để người dùng biết phải làm gì tiếp.
function missingForDrive(profile: UserProfile): string {
  if (profile.status !== 'ACTIVE') return 'Tài khoản đang bị khóa.';
  if (profile.studentVerificationStatus !== 'VERIFIED') return 'Hồ sơ sinh viên chưa được duyệt.';
  if (!profile.vehicleModel || !profile.vehiclePlate) return 'Chưa khai báo loại xe và biển số ở mục bên dưới.';
  if (profile.driverVerificationStatus !== 'VERIFIED') return 'Thông tin tài xế chưa được duyệt.';
  return 'Tài khoản chưa có vai trò tài xế. Lưu lại hồ sơ để cập nhật.';
}

function missingForBook(profile: UserProfile): string {
  if (profile.status !== 'ACTIVE') return 'Tài khoản đang bị khóa.';
  return 'Hồ sơ sinh viên chưa được duyệt.';
}

export function ProfileSummaryCard({ profile }: { profile: UserProfile }) {
  return <>
    <div className="badge-row">
      <span className={`status-pill ${verificationTones[profile.studentVerificationStatus]}`}>
        <ShieldCheck size={15}/>Sinh viên: {verificationLabels[profile.studentVerificationStatus]}
      </span>
      <span className={`status-pill ${verificationTones[profile.driverVerificationStatus]}`}>
        Tài xế: {verificationLabels[profile.driverVerificationStatus]}
      </span>
      <span className={`status-pill ${profile.status === 'ACTIVE' ? 'teal' : 'danger'}`}>
        {profile.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
      </span>
    </div>

    <div className="eligibility-grid">
      <div className={`eligibility-card${profile.eligibility.canBook ? ' ready' : ''}`}>
        <span>Đặt chuyến</span>
        <strong>{profile.eligibility.canBook ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}</strong>
        {!profile.eligibility.canBook && <small>{missingForBook(profile)}</small>}
      </div>
      <div className={`eligibility-card${profile.eligibility.canDrive ? ' ready' : ''}`}>
        <span>Đăng chuyến</span>
        <strong>{profile.eligibility.canDrive ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}</strong>
        {!profile.eligibility.canDrive && <small>{missingForDrive(profile)}</small>}
      </div>
    </div>

    <dl className="profile-details">
      <div><dt>Vai trò</dt><dd>{profile.roles.map(role => roleLabels[role]).join(', ')}</dd></div>
    </dl>

    {profile.studentReviewNote && <p className="review-note-box">Ghi chú sinh viên: {profile.studentReviewNote}</p>}
    {profile.driverReviewNote && <p className="review-note-box">Ghi chú tài xế: {profile.driverReviewNote}</p>}
    {profile.status === 'LOCKED' && <p className="form-error" role="alert">Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.</p>}
    {profile.status === 'ACTIVE' && profile.roles.includes('ADMIN') && (
      <div className="badge-row">
        <Link className="text-link" to="/quan-tri">Quản trị hồ sơ<ArrowRight size={17}/></Link>
      </div>
    )}
  </>;
}
