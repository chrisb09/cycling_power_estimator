import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, Home, Upload } from 'lucide-react';

export default function Navbar() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', backgroundColor: 'var(--bg-card)', 
      borderBottom: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
    }}>
      <Link to={token ? "/dashboard" : "/analyze"} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '32px' }} />
        <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
          <span style={{ color: '#e63946' }}>Power</span> Estimator
        </h1>
      </Link>
      
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {token ? (
          <>
            <Link to="/analyze" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Upload size={18} style={{color: 'var(--primary)'}}/> Analyze Ride
            </Link>
            <Link to="/dashboard" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Home size={18} style={{color: 'var(--primary)'}}/> Dashboard
            </Link>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, padding: 0 }}>
              <LogOut size={18} /> Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/analyze" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>Try Demo</Link>
            <Link to="/login" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>Log In</Link>
            <Link to="/register" className="button" style={{ padding: '8px 16px', textDecoration: 'none' }}>Sign Up</Link>
          </>
        )}
      </div>
    </header>
  );
}
