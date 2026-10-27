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
      </div>
      <div className={`eligibility-card${profile.eligibility.canDrive ? ' ready' : ''}`}>
        <span>Đăng chuyến</span>
        <strong>{profile.eligibility.canDrive ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}</strong>
      </div>
    </div>

    <dl className="profile-details">
      <div><dt>Vai trò</dt><dd>{profile.roles.map(role => roleLabels[role]).join(', ')}</dd></div>
      <div><dt>Tài khoản</dt><dd>{profile.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</dd></div>
      <div><dt>Tài xế</dt><dd>{verificationLabels[profile.driverVerificationStatus]}</dd></div>
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
