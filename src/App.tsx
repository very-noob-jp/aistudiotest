import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ClassicLayout from './components/ClassicLayout';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [forceLoginScreen, setForceLoginScreen] = useState<boolean>(
    window.location.pathname === '/login' || window.location.pathname.startsWith('/login/')
  );

  useEffect(() => {
    fetch('/api/sysinfo')
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          if (window.location.pathname !== '/login') {
            window.history.replaceState(null, '', '/login');
          }
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
        }
      });
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center font-sans text-sm text-[#333333]">
        ルーター管理システムを読み込み中...
      </div>
    );
  }

  if (!isAuthenticated || forceLoginScreen) {
    return (
      <Login
        isAlreadyAdmin={Boolean(isAuthenticated)}
        onLogin={() => {
          setIsAuthenticated(true);
          setForceLoginScreen(false);
          if (window.location.pathname === '/login') {
            window.history.replaceState(null, '', '/');
          }
        }}
      />
    );
  }

  return (
    <ClassicLayout
      onLogout={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setIsAuthenticated(false);
        setForceLoginScreen(true);
        window.history.replaceState(null, '', '/login');
      }}
    />
  );
}
