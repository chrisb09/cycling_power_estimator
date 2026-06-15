import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Analyze from './pages/Analyze';
import AdminPanel from './pages/AdminPanel';
import Profile from './pages/Profile';
import UserSettings from './pages/UserSettings';
import AccountSetup from './pages/AccountSetup';

import { API_BASE } from './api/client';

function Footer() {
  const [info, setInfo] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(res => res.json())
      .then(data => setInfo(data))
      .catch(() => {});
  }, []);

  if (!info) return null;

  return (
    <footer style={{ textAlign: 'center', padding: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'auto', borderTop: '1px solid var(--border-color)', opacity: 0.7 }}>
      v{info.version} • {info.hostname}
    </footer>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/analyze" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/setup" element={<AccountSetup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/settings" element={<UserSettings />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
