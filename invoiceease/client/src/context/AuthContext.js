import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ie_token'));
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (tkn) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('ie_token');
        setToken(null);
      }
    } catch {
      // server offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchMe(token);
    else setLoading(false);
  }, [token, fetchMe]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('ie_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const signup = async (formData) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    localStorage.setItem('ie_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('ie_token');
    setToken(null);
    setUser(null);
  };

  const authFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    return res;
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, authFetch, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
