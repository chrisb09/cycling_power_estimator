import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(null);

  const logout = useCallback(() => {
    setToken(null);
  }, []);
  
  useEffect(() => {
    let timeoutId = null;

    if (token) {
      localStorage.setItem('token', token);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUsername(payload.sub);

        if (payload.exp) {
          const expMs = payload.exp * 1000;
          const timeRemaining = expMs - Date.now();
          if (timeRemaining <= 0) {
            logout();
          } else {
            timeoutId = setTimeout(() => {
              logout();
            }, timeRemaining);
          }
        }
      } catch (e) {
        setUsername(null);
      }
    } else {
      localStorage.removeItem('token');
      setUsername(null);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, setToken, logout, username }}>
      {children}
    </AuthContext.Provider>
  );
};
