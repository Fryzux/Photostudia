import { createContext, useContext, useEffect, useRef, useState, ReactNode, startTransition } from 'react';

import { User } from '../types';
import {
  AUTH_STATE_EVENT,
  getProfile,
  refreshToken as apiRefreshToken,
  tokenStorage,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '../services/api';
import type { LoginCredentials, RegisterData } from '../types';

const PROFILE_CACHE_KEY = 'ps_profile';

function getCachedProfile(): User | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(user: User | null) {
  try {
    if (user) sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {}
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userRequestRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  const loadUser = async () => {
    if (userRequestRef.current) {
      await userRequestRef.current;
      return;
    }

    const task = (async () => {
      try {
        const userData = await getProfile();
        if (!mountedRef.current) return;
        setCachedProfile(userData);
        startTransition(() => {
          setUser(userData);
          setLoading(false);
        });
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        tokenStorage.clearTokens();
        setCachedProfile(null);
        if (!mountedRef.current) return;
        startTransition(() => {
          setUser(null);
          setLoading(false);
        });
      }
    })();

    userRequestRef.current = task;
    await task.finally(() => {
      userRequestRef.current = null;
    });
  };

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          tokenStorage.clearTokens();
          setCachedProfile(null);
          startTransition(() => { setUser(null); });
          return false;
        }
        return prev;
      });
    }, 3000);

    const syncAuthState = async () => {
      if (tokenStorage.getAccessToken()) {
        void loadUser();
        return;
      }

      const rt = tokenStorage.getRefreshToken();
      if (rt) {
        // Есть кэшированный профиль — показываем мгновенно, рефреш идёт фоново
        const cached = getCachedProfile();
        if (cached) {
          startTransition(() => {
            setUser(cached);
            setLoading(false);
          });
          // Фоновый рефреш + обновление профиля
          try {
            await apiRefreshToken();
            void loadUser();
          } catch {
            tokenStorage.clearTokens();
            setCachedProfile(null);
            startTransition(() => { setUser(null); });
          }
          return;
        }

        try {
          await apiRefreshToken();
          void loadUser();
          return;
        } catch {
          tokenStorage.clearTokens();
          setCachedProfile(null);
        }
      }

      startTransition(() => { setUser(null); });
      setLoading(false);
    };

    const handler = () => void syncAuthState();
    void syncAuthState();
    window.addEventListener(AUTH_STATE_EVENT, handler);

    return () => {
      mountedRef.current = false;
      clearTimeout(fallbackTimer);
      window.removeEventListener(AUTH_STATE_EVENT, handler);
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    await apiLogin(credentials);
    await loadUser();
  };

  const register = async (data: RegisterData) => {
    await apiRegister(data);
    await loadUser();
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setCachedProfile(null);
      startTransition(() => { setUser(null); });
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshProfile: loadUser,
    isAuthenticated: !!user,
    isAdmin: Boolean(user?.is_staff || user?.is_superuser),
    isManager: Boolean(user?.is_manager || user?.is_staff),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
