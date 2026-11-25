import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { FederalStateCode, PublicUser, StateRuleConfig } from '@shared/types';
import { getDefaultStateRules } from '@shared/licenseRules';
import { api } from '../api';

interface AuthContextValue {
  user: PublicUser | null;
  needsSetup: boolean;
  departmentName: string;
  federalState: FederalStateCode;
  stateRules: StateRuleConfig;
  loading: boolean;
  isAdmin: boolean;
  canEditMembers: boolean;
  canInspect: boolean;
  refreshAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setup: (payload: {
    department_name: string;
    inspection_interval_months: number;
    federal_state?: FederalStateCode;
    username: string;
    display_name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [departmentName, setDepartmentName] = useState('Freiwillige Feuerwehr');
  const [federalState, setFederalState] = useState<FederalStateCode>('SH');
  const [stateRules, setStateRules] = useState<StateRuleConfig>(() => getDefaultStateRules('SH'));
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      setNeedsSetup(status.needsSetup);
      setUser(status.user);
      setDepartmentName(status.departmentName || 'Freiwillige Feuerwehr');
      const nextState = status.federalState ?? 'SH';
      setFederalState(nextState);
      setStateRules(status.stateRules ?? getDefaultStateRules(nextState));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login({ username, password });
      setUser(res.user);
      setNeedsSetup(false);
      await refreshAuth();
    },
    [refreshAuth],
  );

  const setup = useCallback(
    async (payload: {
      department_name: string;
      inspection_interval_months: number;
      federal_state?: FederalStateCode;
      username: string;
      display_name: string;
      email: string;
      password: string;
    }) => {
      const res = await api.setup(payload);
      setUser(res.user);
      setNeedsSetup(false);
      setDepartmentName(payload.department_name);
      if (payload.federal_state) {
        setFederalState(payload.federal_state);
        setStateRules(getDefaultStateRules(payload.federal_state));
      }
      await refreshAuth();
    },
    [refreshAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const isAdmin = user?.role === 'admin';
  const canEditMembers = user?.role === 'admin' || user?.role === 'inspector';
  const canInspect = user?.role === 'admin' || user?.role === 'inspector';

  return (
    <AuthContext.Provider
      value={{
        user,
        needsSetup,
        departmentName,
        federalState,
        stateRules,
        loading,
        isAdmin,
        canEditMembers,
        canInspect,
        refreshAuth,
        login,
        setup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
