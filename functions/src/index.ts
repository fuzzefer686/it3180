import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-southeast1', minInstances: 0, maxInstances: 2, timeoutSeconds: 30 });
export { healthCheck, getMyProfile, adminFoundationInfo } from './modules/foundation';
export { getMyWallet, topUpDemo, payBooking, getBookingPayment } from './modules/wallets';
