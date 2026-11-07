import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../../../../shared/contracts';
import { supabase } from '../../lib/supabase';
import { callFunction, errorMessage } from '../../lib/callable';
interface Session {
  user: User | null; profile: UserProfile | null;
  loading: boolean; profileLoading: boolean; profileError: string;
  refreshProfile: () => void;
}
const SessionContext = createContext<Session | null>(null);
// Phiên chỉ dùng hiển thị. Quyền nghiệp vụ vẫn do backend kiểm tra.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [revision, setRevision] = useState(0);
  const currentUid = useRef<string | null>(null);
  const uid = user?.id ?? null;
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUid = session?.user.id ?? null;
      if (nextUid !== currentUid.current) {
        currentUid.current = nextUid;
        setProfile(null); setProfileError(''); setProfileLoading(Boolean(nextUid));
      }
      // TOKEN_REFRESHED/SIGNED_IN cùng uid không làm mất hồ sơ hoặc gửi RPC lại.
      setUser(session?.user ?? null); setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setProfileError(''); setProfileLoading(Boolean(uid));
    if (uid) {
      callFunction('getMyProfile', {}).then(value => {
        if (value.uid !== uid) throw new Error('Profile identity mismatch');
        if (active && currentUid.current === uid) setProfile(value);
      }).catch(error => {
        if (active && currentUid.current === uid) {
          setProfile(null); setProfileError(errorMessage(error));
        }
      }).finally(() => {
        if (active && currentUid.current === uid) setProfileLoading(false);
      });
    }
    return () => { active = false; };
  }, [uid, revision]);
  return <SessionContext.Provider value={{ user, profile: profile?.uid === uid ? profile : null, loading, profileLoading, profileError, refreshProfile: () => setRevision(value => value + 1) }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider chưa được gắn vào ứng dụng.');
  return session;
}
