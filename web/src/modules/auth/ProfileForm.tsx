import { useEffect, useRef, useState, type FormEvent } from 'react';
import { profileInputSchema, type UserProfile } from '../../../../shared/contracts';
import { callFunction, errorMessage } from '../../lib/callable';

function fields(profile: UserProfile) {
  return {
    displayName: profile.displayName,
    phone: profile.phone ?? '',
    school: profile.school ?? '',
    studentCode: profile.studentCode ?? '',
    studentEvidenceDemo: profile.studentEvidenceDemo ?? '',
    vehicleModel: profile.vehicleModel ?? '',
    vehiclePlate: profile.vehiclePlate ?? '',
  };
}

export function ProfileForm({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const [values, setValues] = useState(() => fields(profile));
  const [driver, setDriver] = useState(Boolean(profile.vehicleModel));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    setValues(fields(profile));
    setDriver(Boolean(profile.vehicleModel));
  }, [profile]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    setNotice('');
    const parsed = profileInputSchema.safeParse({
      ...values,
      vehicleModel: driver ? values.vehicleModel : null,
      vehiclePlate: driver ? values.vehiclePlate : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await callFunction('updateMyProfile', parsed.data);
      setNotice('Đã lưu hồ sơ.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const textFields = [
    ['displayName', 'Họ tên', 100],
    ['phone', 'Số điện thoại', 20],
    ['school', 'Trường', 150],
    ['studentCode', 'Mã sinh viên', 50],
  ] as const;

  return <section className="profile-editor" aria-labelledby="profile-form-title">
    <h2 id="profile-form-title">Hồ sơ sinh viên</h2>
    <p className="account-description">Minh chứng chỉ dùng dữ liệu hư cấu để duyệt thử. Tuyệt đối không nhập số CCCD hay giấy tờ thật.</p>
    <form className="login-form" onSubmit={save}>
      <fieldset disabled={busy || profile.status === 'LOCKED'}>
        <div className="form-grid-2">
          {textFields.map(([name, label, max]) => (
            <div className="form-field" key={name}>
              <label htmlFor={`profile-${name}`}>{label}</label>
              <div className="form-input">
                <input
                  id={`profile-${name}`}
                  name={name}
                  type={name === 'phone' ? 'tel' : 'text'}
                  maxLength={max}
                  required
                  value={values[name]}
                  autoComplete={name === 'displayName' ? 'name' : name === 'phone' ? 'tel' : 'off'}
                  onChange={event => { setValues({ ...values, [name]: event.target.value }); setError(''); setNotice(''); }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="form-field">
          <label htmlFor="student-evidence">Minh chứng hư cấu</label>
          <textarea
            id="student-evidence"
            maxLength={500}
            required
            placeholder="Ví dụ: Thẻ sinh viên DEMO-001, khóa K68, dữ liệu hư cấu"
            value={values.studentEvidenceDemo}
            onChange={event => { setValues({ ...values, studentEvidenceDemo: event.target.value }); setError(''); setNotice(''); }}
          />
        </div>

        <div className="driver-toggle-card">
          <label className="checkbox-field">
            <input type="checkbox" checked={driver} onChange={event => { setDriver(event.target.checked); setError(''); setNotice(''); }}/>
            Đăng ký làm tài xế xe máy
          </label>
          {driver && (
            <div className="form-grid-2">
              <div className="form-field">
                <label htmlFor="vehicle-model">Loại xe máy</label>
                <div className="form-input">
                  <input id="vehicle-model" placeholder="Ví dụ: Honda Wave Alpha" required maxLength={100} value={values.vehicleModel}
                    onChange={event => setValues({ ...values, vehicleModel: event.target.value })}/>
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="vehicle-plate">Biển số xe (dữ liệu thử)</label>
                <div className="form-input">
                  <input id="vehicle-plate" placeholder="Ví dụ: 99-DEMO-01" required maxLength={20} value={values.vehiclePlate}
                    onChange={event => setValues({ ...values, vehiclePlate: event.target.value })}/>
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="button primary" type="submit">{busy ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
    </form>
  </section>;
}
