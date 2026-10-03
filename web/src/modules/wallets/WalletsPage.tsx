import { ArrowRight, ArrowUpDown, CircleHelp, Plus, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
export function WalletsPage() {
  const { user } = useSession();
  return <div className="inner-page">
    <header className="page-heading"><h1>Ví điểm</h1><p>Điểm cho chuyến đi cùng, lịch sử cho mỗi lần sử dụng.</p></header>
    <div className="wallet-layout">
      <section className="balance-panel" aria-labelledby="balance-title"><div className="balance-top"><WalletCards size={28}/><span>Điểm mô phỏng</span></div><h2 id="balance-title">Số điểm của bạn</h2><p className="balance-value">Chưa khả dụng</p><p className="balance-caption">Ví chưa được kích hoạt. Hiện chưa thể thêm hoặc trả điểm.</p><button className="button primary" disabled><Plus size={18}/> Thêm điểm</button><p className="wallet-footnote">Điểm không có giá trị tiền và không thể quy đổi.</p></section>
      <section className="wallet-explainer"><CircleHelp size={24}/><h2>Chỉ dùng điểm thử</h2><p>Ví mô phỏng cách trả phí chuyến đi. Bạn không cần liên kết ngân hàng hay dùng tiền thật.</p><div className="wallet-rule"><span>Thời điểm trả điểm</span><strong>Sau khi bạn xuống xe</strong></div><div className="wallet-rule"><span>Cách tính điểm dự kiến</span><strong>5.000 điểm / km</strong></div>{!user && <Link className="text-link" to="/tai-khoan">Đăng nhập<ArrowRight size={18}/></Link>}</section>
    </div>
    <section className="transactions" aria-labelledby="transactions-title"><h2 id="transactions-title">Lịch sử điểm</h2><div className="transaction-empty"><ArrowUpDown size={25}/><div><h3>Lịch sử điểm sẽ xuất hiện ở đây</h3><p>Hiện chưa thể tải giao dịch. Không có điểm nào được cộng hoặc trừ từ trang này.</p></div></div></section>
  </div>;
}
