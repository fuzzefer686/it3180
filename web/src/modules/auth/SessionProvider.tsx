import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../../../../shared/contracts';
import { supabase } from '../../lib/supabase';
import { callFunction, errorMessage } from '../../lib/callable';

export const MOCK_ADMIN_USER: User = {
  id: 'mock-admin-001',
  app_metadata: {},
  user_metadata: { name: 'Admin Quản trị viên' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'admin@vecung.test',
};

export const MOCK_ADMIN_PROFILE: UserProfile = {
  uid: 'mock-admin-001',
  displayName: 'Admin Quản Trị Viên (Demo)',
  roles: ['ADMIN', 'USER', 'DRIVER'],
  status: 'ACTIVE',
  studentVerificationStatus: 'VERIFIED',
};

interface Session {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string;
  refreshProfile: () => void;
  loginAsMockAdmin: () => void;
  logoutSession: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    // Kiểm tra xem có đang bật chế độ Mock Admin không
    const isMock = localStorage.getItem('is_mock_admin') === 'true';
    if (isMock) {
      setUser(MOCK_ADMIN_USER);
      setProfile(MOCK_ADMIN_PROFILE);
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setProfile(null);
      setProfileError('');
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (localStorage.getItem('is_mock_admin') === 'true') {
      return;
    }

    let active = true;
    setProfile(null);
    setProfileError('');
    setProfileLoading(Boolean(user));

    if (user) {
      callFunction('getMyProfile', {})
        .then((value) => {
          if (active && value.uid === user.id) setProfile(value);
        })
        .catch((error) => {
          if (active) setProfileError(errorMessage(error));
        })
        .finally(() => {
          if (active) setProfileLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [user, revision]);

  const loginAsMockAdmin = () => {
    localStorage.setItem('is_mock_admin', 'true');
    setUser(MOCK_ADMIN_USER);
    setProfile(MOCK_ADMIN_PROFILE);
    setProfileError('');
  };

  const logoutSession = async () => {
    if (localStorage.getItem('is_mock_admin') === 'true') {
      localStorage.removeItem('is_mock_admin');
      setUser(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        profileError,
        refreshProfile: () => setRevision((value) => value + 1),
        loginAsMockAdmin,
        logoutSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider chưa được gắn vào ứng dụng.');
  return session;
}
