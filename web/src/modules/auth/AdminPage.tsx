import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { ApiContracts, UserProfile } from '../../../../shared/contracts';
import { callFunction, errorMessage } from '../../lib/callable';
import { useSession } from './SessionProvider';

type Verification = UserProfile['studentVerificationStatus'];
const labels: Record<Verification, string> = { PENDING: 'Chờ duyệt', VERIFIED: 'Đã duyệt', REJECTED: 'Từ chối' };
const tones: Record<Verification, 'amber' | 'emerald' | 'danger'> = { PENDING: 'amber', VERIFIED: 'emerald', REJECTED: 'danger' };

export function AdminPage() {
  const { user, refreshProfile } = useSession();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedUid, setSelectedUid] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const selected = users.find(profile => profile.uid === selectedUid);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setUsers([]); setSelectedUid(''); setReason(''); setNotice('');
    callFunction('adminListUsers', { page }).then(result => {
      if (active) { setUsers(result.users); setTotal(result.total); }
    }).catch(err => { if (active) setError(errorMessage(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, revision]);

  async function mutate<K extends 'adminReviewUser' | 'adminSetUserStatus'>(name: K, input: ApiContracts[K]['input']) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await callFunction(name, input);
      setUsers(values => values.map(value => value.uid === result.uid ? result : value));
      setReason(''); setNotice('Đã cập nhật tài khoản.');
      if (result.uid === user?.id) refreshProfile();
    } catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }

  function review(kind: 'STUDENT' | 'DRIVER', decision: 'VERIFIED' | 'REJECTED') {
    if (!selected) return;
    if (decision === 'REJECTED' && !reason.trim()) { setError('Cần ghi lý do từ chối.'); return; }
    void mutate('adminReviewUser', { uid: selected.uid, kind, decision, reason: reason.trim() });
  }

  return <div className="inner-page">
    <header className="page-heading">
      <div>
        <h1>Quản trị hồ sơ</h1>
        <p>Duyệt xác minh sinh viên, hồ sơ xe máy tài xế và quản lý trạng thái hoạt động tài khoản.</p>
      </div>
      <span className="status-pill teal"><ShieldCheck size={15}/> Tổng {total} hồ sơ</span>
    </header>

    <div className="admin-toolbar">
      <button className="button secondary compact" type="button" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}>
        <RefreshCw size={14}/> Tải lại danh sách
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
    </div>

    <div className="admin-layout">
      <section className="admin-queue" aria-label="Danh sách tài khoản">
        <div className="admin-queue-head">
          <span>Hàng đợi tài khoản</span>
          <span>Trang {page}</span>
        </div>
        {loading ? (
          <div className="content-skeleton compact" role="status"><p className="trip-muted">Đang tải tài khoản...</p><div/><div/></div>
        ) : users.length === 0 ? (
          <p className="account-description">Không có hồ sơ để hiển thị.</p>
        ) : (
          users.map(profile => (
            <button key={profile.uid} type="button" className={`admin-user${selectedUid === profile.uid ? ' selected' : ''}`} disabled={busy}
              onClick={() => { setSelectedUid(profile.uid); setReason(''); setError(''); setNotice(''); }}>
              <div className="admin-user-top">
                <strong>{profile.displayName}</strong>
                <span className={`status-pill ${tones[profile.studentVerificationStatus]}`}>{labels[profile.studentVerificationStatus]}</span>
              </div>
              <span>Sinh viên: {labels[profile.studentVerificationStatus]} · Tài xế: {labels[profile.driverVerificationStatus]} · {profile.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span>
            </button>
          ))
        )}
        <div className="profile-actions">
          <button className="button secondary compact" type="button" disabled={page === 1 || loading || busy} onClick={() => setPage(value => value - 1)}>Trang trước</button>
          <span className="trip-muted">Trang {page}</span>
          <button className="button secondary compact" type="button" disabled={page * 20 >= total || loading || busy} onClick={() => setPage(value => value + 1)}>Trang sau</button>
        </div>
      </section>

      <section className="account-panel" aria-label="Chi tiết hồ sơ">
        {!selected ? (
          <div className="empty-state">
            <div className="empty-icon"><ShieldCheck size={30}/></div>
            <h2>Chọn hồ sơ để kiểm duyệt</h2>
            <p>Chọn tài khoản ở cột bên trái để đối chiếu thông tin sinh viên, xe máy hư cấu và phê duyệt quyền.</p>
          </div>
        ) : <>
          <div className="admin-user-top">
            <h2>{selected.displayName}</h2>
            <span className={`status-pill ${selected.status === 'ACTIVE' ? 'teal' : 'danger'}`}>
              {selected.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
            </span>
          </div>
          <dl className="profile-details">
            {[
              ['ID', selected.uid], ['Quyền', selected.roles.join(', ')], ['Điện thoại', selected.phone],
              ['Trường', selected.school], ['Mã sinh viên', selected.studentCode], ['Minh chứng hư cấu', selected.studentEvidenceDemo],
              ['Sinh viên', labels[selected.studentVerificationStatus]], ['Ghi chú sinh viên', selected.studentReviewNote],
              ['Xe máy', selected.vehicleModel], ['Biển số', selected.vehiclePlate],
              ['Tài xế', labels[selected.driverVerificationStatus]], ['Ghi chú tài xế', selected.driverReviewNote],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Chưa có'}</dd></div>)}
          </dl>

          <div className="form-field">
            <label htmlFor="review-reason">Ghi chú duyệt / lý do từ chối</label>
            <textarea id="review-reason" maxLength={500} placeholder="Nhập ghi chú kiểm duyệt (bắt buộc khi từ chối)…" disabled={busy} value={reason}
              onChange={event => setReason(event.target.value)}/>
          </div>

          <div className="admin-decision-group">
            <span className="admin-decision-label">1. Xác minh sinh viên</span>
            <div className="trip-actions">
              <button className="button primary" type="button" disabled={busy || selected.status !== 'ACTIVE'} onClick={() => review('STUDENT', 'VERIFIED')}>Duyệt sinh viên</button>
              <button className="button secondary" type="button" disabled={busy} onClick={() => review('STUDENT', 'REJECTED')}>Từ chối sinh viên</button>
            </div>
          </div>

          <div className="admin-decision-group">
            <span className="admin-decision-label">2. Xác minh tài xế xe máy</span>
            <div className="trip-actions">
              <button className="button primary" type="button" disabled={busy || selected.status !== 'ACTIVE' || selected.studentVerificationStatus !== 'VERIFIED' || !selected.vehicleModel} onClick={() => review('DRIVER', 'VERIFIED')}>Duyệt tài xế</button>
              <button className="button secondary" type="button" disabled={busy} onClick={() => review('DRIVER', 'REJECTED')}>Từ chối tài xế</button>
            </div>
          </div>

          <div className="admin-decision-group">
            <span className="admin-decision-label">3. Trạng thái tài khoản</span>
            <div className="trip-actions">
              <button className="button danger-outline" type="button" disabled={busy || selected.uid === user?.id}
                onClick={() => void mutate('adminSetUserStatus', { uid: selected.uid, status: selected.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' })}>
                {selected.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở tài khoản'}
              </button>
            </div>
          </div>
        </>}
      </section>
    </div>
  </div>;
}
