import { createContext, useContext, useEffect, useState, ReactNode, startTransition } from 'react';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      window.removeEventListener(AUTH_STATE_EVENT, syncAuthState);
    };
  }, []);

  const loadUser = async () => {
    setLoading(true);
    try {
      const userData = await getProfile();
      startTransition(() => {
        setUser(userData);
      });
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      tokenStorage.clearTokens();
      startTransition(() => {
        setUser(null);
      });
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    await apiLogin(credentials);
    await loadUser();
  };

  const register = async (data: RegisterData) => {
    await apiRegister(data);
    await loadUser();
  };

  const logout = async () => {
    await apiLogout();
    startTransition(() => {
      setUser(null);
    });
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
