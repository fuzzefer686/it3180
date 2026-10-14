import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null); setProfile(null); setProfileError(''); setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setProfile(null); setProfileError(''); setProfileLoading(Boolean(user));
    if (user) {
      callFunction('getMyProfile', {}).then(value => {
        if (active && value.uid === user.id) setProfile(value);
      }).catch(error => {
        if (active) setProfileError(errorMessage(error));
      }).finally(() => {
        if (active) setProfileLoading(false);
      });
    }
    return () => { active = false; };
  }, [user, revision]);
  return <SessionContext.Provider value={{ user, profile, loading, profileLoading, profileError, refreshProfile: () => setRevision(value => value + 1) }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider chưa được gắn vào ứng dụng.');
  return session;
}
