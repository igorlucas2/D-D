import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setUnauthorizedHandler } from '@/lib/api';
import type { LoginRequest, RegisterRequest } from '@/lib/api-contract';
import type { AuthUser } from '@/lib/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  /** true quando a sessão terminou sozinha (token vencido ou recusado). */
  sessionExpired: boolean;
  expireSession: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  setHydrated: () => void;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isHydrated: false,
      sessionExpired: false,

      login: async (email, password) => {
        const payload: LoginRequest = { email, password };
        const data = await api.post<AuthResponse>('/auth/login', payload);
        set({ token: data.accessToken, user: data.user, sessionExpired: false });
      },

      register: async (email, password, displayName) => {
        const payload: RegisterRequest = { email, password, displayName };
        const data = await api.post<AuthResponse>('/auth/register', payload);
        set({ token: data.accessToken, user: data.user });
      },

      logout: () => set({ token: null, user: null, sessionExpired: false }),

      expireSession: () => {
        if (!get().token) return;
        set({ token: null, user: null, sessionExpired: true });
      },

      refreshProfile: async () => {
        const token = get().token;
        if (!token) return;
        const user = await api.get<AuthUser>('/users/me', token);
        set({ user });
      },

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'rpg-auth',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Storage corrompido: descarta a sessão salva e libera a interface.
          // O RequireAuth também tem um limite de espera como rede de segurança.
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.removeItem('rpg-auth');
            } catch {
              // sem acesso ao storage: segue deslogado
            }
          }
          state?.setHydrated();
          return;
        }
        // Token salvo já vencido: sai antes de qualquer requisição falhar.
        if (state?.token && isTokenExpired(state.token)) state.expireSession();
        state?.setHydrated();
      },
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

/** Lê o `exp` do JWT (sem validar assinatura: isso é papel do servidor). */
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' && json.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

setUnauthorizedHandler(() => useAuthStore.getState().expireSession());
