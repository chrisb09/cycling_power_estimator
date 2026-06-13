import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { registerUser, fetchInviteDetails } from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteKey, setInviteKey] = useState('');
  const [inviteCreator, setInviteCreator] = useState(null);
  const [weightKg, setWeightKg] = useState(75.0);
  const [heightCm, setHeightCm] = useState(175.0);
  const [error, setError] = useState(null);
  const { setToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const key = searchParams.get('key');
    if (key) {
      setInviteKey(key);
      fetchInviteDetails(key)
        .then(data => {
          if (!data.is_used) {
            setInviteCreator(data.creator_username);
          }
        })
        .catch(err => console.error("Failed to load invite details", err));
    }
  }, [searchParams]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const data = await registerUser({ username, password, invite_key: inviteKey, weight_kg: parseFloat(weightKg), height_cm: parseFloat(heightCm) });
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
        <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>Invite Key</label>
            {inviteCreator && (
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '4px' }}>
                You have received an invite key from <strong>{inviteCreator}</strong>
              </p>
            )}
            <input 
              type="text" 
              value={inviteKey} 
              onChange={e => setInviteKey(e.target.value)} 
              required 
              style={{ width: '100%', padding: '10px' }}
              placeholder="INVITE-XXXXXXXX"
            />
        </div>
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
