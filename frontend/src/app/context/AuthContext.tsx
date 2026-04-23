import { createContext, useContext, useEffect, useRef, useState, ReactNode, startTransition } from 'react';

import { User } from '../types';
import {
  AUTH_STATE_EVENT,
  getProfile,
  tokenStorage,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '../services/api';
import type { LoginCredentials, RegisterData } from '../types';

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
      setLoading(true);
      try {
        const userData = await getProfile();
        if (!mountedRef.current) return;
        startTransition(() => {
          setUser(userData);
          setLoading(false);
        });
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        tokenStorage.clearTokens();
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
    const syncAuthState = () => {
      const token = tokenStorage.getAccessToken();

      if (token) {
        void loadUser();
        return;
      }

      startTransition(() => {
        setUser(null);
      });
      setLoading(false);
    };

    syncAuthState();
    window.addEventListener(AUTH_STATE_EVENT, syncAuthState);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(AUTH_STATE_EVENT, syncAuthState);
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
      startTransition(() => {
        setUser(null);
      });
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
