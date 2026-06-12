import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [weightKg, setWeightKg] = useState(75.0);
  const [error, setError] = useState(null);
  const { setToken } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const data = await registerUser({ username, password, weight_kg: parseFloat(weightKg), height_cm: 175.0 });
      setToken(data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '10vh auto', padding: '32px' }} className="glass-panel animate-fade-in">
      <h2 style={{ marginTop: 0, marginBottom: '24px', textAlign: 'center' }}>Create Account</h2>
      {error && <div style={{ color: 'var(--accent)', background: 'rgba(255, 71, 87, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Body Weight (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              value={weightKg} 
              onChange={e => setWeightKg(e.target.value)} 
              required 
            />
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Register</button>
      </form>
      <p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Log in</Link>
      </p>
    </div>
  );
}
