import { ArrowRight, ArrowUpDown, CircleHelp, Plus, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';

export function WalletsPage() {
  const { user } = useSession();

  return <div className="inner-page">
    <header className="page-heading">
      <div>
        <h1>Ví điểm</h1>
        <p>Điểm mô phỏng cho các chuyến đi cùng sinh viên, minh bạch theo từng ki-lô-mét lộ trình.</p>
      </div>
      <span className="status-pill amber">Mô phỏng học phần · Không dùng tiền thật</span>
    </header>

    <div className="wallet-layout">
      <section className="balance-panel" aria-labelledby="balance-title">
        <div>
          <div className="balance-top">
            <span className="balance-icon-box"><WalletCards size={24}/></span>
            <span className="balance-badge">Điểm mô phỏng</span>
          </div>
          <h2 id="balance-title">Số điểm của bạn</h2>
          <p className="balance-value">Chưa khả dụng</p>
          <p className="balance-caption">Ví chưa được kích hoạt ở máy chủ. Hiện chưa thể nạp thêm hoặc trừ điểm chuyến đi.</p>
          <button className="button primary" type="button" disabled><Plus size={17}/> Thêm điểm</button>
        </div>
        <p className="wallet-footnote">Điểm chỉ phục vụ mô phỏng môn học, không có giá trị tiền tệ và không thể quy đổi.</p>
      </section>

      <section className="wallet-explainer">
        <div className="wallet-explainer-head">
          <CircleHelp size={22}/>
          <h2>Nguyên tắc tính điểm minh bạch</h2>
        </div>
        <p>Ví mô phỏng cách chia sẻ chi phí xăng xe giữa sinh viên cùng trường, không liên kết ngân hàng hay ví điện tử thật.</p>
        <div className="wallet-rules">
          <div className="wallet-rule">
            <span>Đơn giá tham khảo</span>
            <strong>5.000 điểm / km</strong>
          </div>
          <div className="wallet-rule">
            <span>Thời điểm đối soát</span>
            <strong>Sau khi bạn xuống xe</strong>
          </div>
          <div className="wallet-rule">
            <span>Cơ sở quãng đường</span>
            <strong>Theo chặng đón – trả VietMap</strong>
          </div>
        </div>
        {!user && <Link className="text-link" to="/tai-khoan">Đăng nhập để liên kết tài khoản<ArrowRight size={17}/></Link>}
      </section>
    </div>

    <section className="transactions" aria-labelledby="transactions-title">
      <h2 id="transactions-title">Lịch sử điểm</h2>
      <div className="transaction-empty">
        <span className="transaction-empty-icon"><ArrowUpDown size={22}/></span>
        <div>
          <h3>Lịch sử điểm sẽ xuất hiện ở đây</h3>
          <p>Hiện chưa thể tải giao dịch. Không có điểm nào được cộng hoặc trừ từ trang này.</p>
        </div>
      </div>
    </section>
  </div>;
}
