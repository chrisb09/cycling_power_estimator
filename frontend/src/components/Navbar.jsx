import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, Home, Upload, Settings, Shield, User, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { token, logout, username } = useContext(AuthContext);
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
      <Link to={token ? "/dashboard" : "/analyze"} onClick={() => setIsOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
        <img src="/logo.png" alt="Logo" style={{ height: '32px' }} />
        <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
          <span style={{ color: '#e63946' }}>Power</span> Estimator
        </h1>
      </Link>
      
      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={28} /> : <Menu size={28} />}
      </button>
      
      <div className={`nav-links ${isOpen ? 'open' : ''}`}>
        {token ? (
          <>
            <Link to="/analyze" onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Upload size={18} style={{color: 'var(--primary)'}}/> Analyze Ride
            </Link>
            <Link to="/dashboard" onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Home size={18} style={{color: 'var(--primary)'}}/> Dashboard
            </Link>
            <Link to={`/profile/${username}`} onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <User size={18} style={{color: 'var(--primary)'}}/> Profile
            </Link>
            <Link to="/settings" onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Settings size={18} style={{color: 'var(--primary)'}}/> Settings
            </Link>
            <Link to="/admin" onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Shield size={18} style={{color: 'var(--primary)'}}/> Admin
            </Link>
            <button onClick={() => { setIsOpen(false); handleLogout(); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, padding: 0 }}>
              <LogOut size={18} /> Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/analyze" onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>Try Demo</Link>
            <Link to="/login" onClick={() => setIsOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>Log In</Link>
            <Link to="/register" onClick={() => setIsOpen(false)} className="button" style={{ padding: '8px 16px', textDecoration: 'none' }}>Sign Up</Link>
          </>
        )}
      </div>
    </header>
  );
}
