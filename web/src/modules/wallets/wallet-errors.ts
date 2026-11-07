import { errorMessage } from '../../lib/errors';

export interface WalletErrorContext {
  balancePoints?: number;
  farePoints?: number | null;
}

export function walletError(error: unknown, context?: WalletErrorContext): string {
  const formatInsufficient = (required?: number | null, current?: number) => {
    if (typeof required === 'number' && typeof current === 'number' && required > current) {
      const missing = required - current;
      return `Không đủ điểm thanh toán: Chuyến đi cần ${required.toLocaleString('vi-VN')} điểm nhưng số dư ví hiện tại là ${current.toLocaleString('vi-VN')} điểm (thiếu ${missing.toLocaleString('vi-VN')} điểm). Vui lòng bấm "Thêm 100.000 điểm thử" trước khi thanh toán.`;
    }
    return 'Không đủ điểm thanh toán: Số dư ví hiện tại không đủ để chi trả cho chuyến đi này. Vui lòng bấm "Thêm 100.000 điểm thử" trước khi thanh toán.';
  };

  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message);
    if (msg === 'Insufficient balance' || msg.includes('Insufficient balance') || msg.includes('Số dư không đủ')) {
      const match = msg.match(/\(Cần\s+(\d+),\s*hiện có\s+(\d+)\)/i);
      if (match) {
        return formatInsufficient(Number(match[1]), Number(match[2]));
      }
      return formatInsufficient(context?.farePoints, context?.balancePoints);
    }
    if (msg === 'Booking not ready for payment' || msg.includes('COMPLETED')) {
      return 'Chuyến đi chưa ở trạng thái hoàn thành (COMPLETED) nên chưa thể thanh toán. Vui lòng đợi tài xế xác nhận đã trả khách.';
    }
    if (msg === 'Only passenger can pay' || msg.includes('hành khách')) {
      return 'Chỉ hành khách của chuyến đi này mới có quyền thực hiện thanh toán.';
    }
    if (msg === 'Invalid bookingId') {
      return 'Mã đặt chuyến (Booking UUID) không đúng định dạng. Vui lòng kiểm tra lại.';
    }
    if (msg === 'Booking not found') {
      return 'Không tìm thấy thông tin đặt chuyến này. Vui lòng kiểm tra lại mã Booking ID.';
    }
  }

  if (
    typeof context?.farePoints === 'number' &&
    typeof context?.balancePoints === 'number' &&
    context.balancePoints < context.farePoints
  ) {
    return formatInsufficient(context.farePoints, context.balancePoints);
  }

  return errorMessage(error);
}
