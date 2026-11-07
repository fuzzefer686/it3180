import { useEffect } from 'react';

// Existing read APIs only; refresh while this screen is visible, with no Realtime setup.
export function useBookingRefresh(refresh: () => void) {
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
}
