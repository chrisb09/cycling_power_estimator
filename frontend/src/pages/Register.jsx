import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { registerUser, fetchInviteDetails } from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteKey, setInviteKey] = useState('');
  const [inviteCreator, setInviteCreator] = useState(null);
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
      const data = await registerUser({ 
        username, 
        password, 
        invite_key: inviteKey, 
        weight_kg: 75.0, 
        height_cm: 175.0 
      });
      setToken(data.access_token);
      navigate('/setup');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px 32px' }}>
        <h2 style={{ margin: '0 0 24px 0', fontSize: '1.8rem', textAlign: 'center', color: 'var(--primary)' }}>Create Account</h2>
        {error && <div style={{ color: 'var(--accent)', marginBottom: '16px', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}
        
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              style={{ width: '100%', padding: '10px' }}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '10px' }}
            />
          </div>
          <div className="form-group">
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

          <button type="submit" className="btn-primary" style={{ padding: '12px', marginTop: '8px' }}>Sign Up</button>
        </form>
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Log in</Link>
        </div>
      </div>
    </div>
  );
}
