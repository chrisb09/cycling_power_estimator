import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { setToken } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await loginUser(username, password);
      setToken(data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '10vh auto', padding: '32px' }} className="glass-panel animate-fade-in">
      <h2 style={{ marginTop: 0, marginBottom: '24px', textAlign: 'center' }}>Welcome Back</h2>
      {error && <div style={{ color: 'var(--accent)', background: 'rgba(255, 71, 87, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input 
          type="text"
          placeholder="Username" 
          value={username} 
          onChange={e => setUsername(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
        />
        <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Log In</button>
      </form>
      <p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Register</Link>
      </p>
    </div>
  );
}
