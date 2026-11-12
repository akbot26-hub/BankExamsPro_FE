import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!import.meta.env.DEV) return null;
    try { return JSON.parse(sessionStorage.getItem('bxp_preview_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const value = {
    user,
    loading,
    async signInWithOtp(identifier, code) {
      const d = await api('/auth/verify-otp', { method: 'POST', body: { identifier, code } });
      setToken(d.token);
      setUser(d.user);
      return d.user;
    },
    signOut() {
      setToken(null);
      try { sessionStorage.removeItem('bxp_preview_user'); } catch { /* noop */ }
      setUser(null);
    },
    enterPreview() {
      if (!import.meta.env.DEV) throw new Error('Preview sign-in is only available in development.');
      const previewUser = {
        id: 'preview_student',
        name: 'Arjun Sharma',
        email: 'arjun@student.in',
        role: 'student',
        enrolledExamIds: [],
      };
      setToken(null);
      setUser(previewUser);
      try { sessionStorage.setItem('bxp_preview_user', JSON.stringify(previewUser)); } catch { /* noop */ }
      return previewUser;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
