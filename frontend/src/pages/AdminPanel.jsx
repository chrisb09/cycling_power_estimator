import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetchUsers, adminFetchInvites, adminGenerateInvite, adminUpdateUserRole, adminUpdateUserStatus, fetchMe, adminNukeDatabase } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Shield, Users, Key, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nukeCode, setNukeCode] = useState('');
  const [nuking, setNuking] = useState(false);
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Verify admin status
    fetchMe().then(user => {
      if (user.role !== 'admin') {
        alert('Admin privileges required.');
        navigate('/dashboard');
        return;
      }
      
      Promise.all([adminFetchUsers(), adminFetchInvites()])
        .then(([u, i]) => {
          setUsers(u);
          setInvites(i);
          setLoading(false);
        })
        .catch(err => {
          alert(err.message);
          setLoading(false);
        });
    });
  }, [token, navigate]);

  const handleRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const updated = await adminUpdateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? updated : u));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
      const updated = await adminUpdateUserStatus(userId, newStatus);
      setUsers(users.map(u => u.id === userId ? updated : u));
    } catch (err) {
      alert(err.message);
    }
  };

  const generateInvite = async () => {
    try {
      const invite = await adminGenerateInvite();
      setInvites([invite, ...invites]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleNuke = async () => {
    if (!nukeCode.trim()) return;
    if (!window.confirm("WARNING: This will completely wipe all users, rides, bikes, and invites from the database. This action is irreversible. Are you absolutely sure?")) {
      return;
    }
    setNuking(true);
    try {
      const res = await adminNukeDatabase(nukeCode.trim());
      alert(res.message);
      // Auto logout since our user might be deleted
      window.location.href = '/login';
    } catch (err) {
      alert(err.message);
      setNuking(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Shield size={32} color="var(--primary)" />
        <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary)' }}>Admin Control Panel</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} /> User Management</h3>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 0' }}>Username</th>
                <th style={{ padding: '8px 0' }}>Role</th>
                <th style={{ padding: '8px 0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 500 }}>{u.username}</td>
                  <td style={{ padding: '12px 0' }}>
                    <button 
                      onClick={() => handleRoleToggle(u.id, u.role)}
                      style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', color: u.role === 'admin' ? 'var(--accent)' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {u.role.toUpperCase()}
                    </button>
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    <button 
                      onClick={() => handleStatusToggle(u.id, u.is_active)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title={u.is_active ? "Disable User" : "Enable User"}
                    >
                      {u.is_active ? <CheckCircle size={20} color="#10B981" /> : <XCircle size={20} color="#EF4444" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Key size={20} /> Invite Keys</h3>
            <button onClick={generateInvite} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>+ Generate Key</button>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 0' }}>Key</th>
                <th style={{ padding: '8px 0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(i => (
                <tr key={i.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 0', fontFamily: 'monospace', fontSize: '0.9rem', color: i.is_used ? 'var(--text-secondary)' : 'var(--primary)' }}>
                    {i.key}
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    {i.is_used ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Used by #{i.used_by}</span> : <span style={{ color: '#10B981', fontSize: '0.85rem', fontWeight: 600 }}>Active</span>}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    {!i.is_used && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/register?key=${i.key}`);
                          alert("Invite link copied!");
                        }}
                        style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Copy Link
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr>
                  <td colSpan="2" style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No invite keys generated.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginTop: '32px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <AlertTriangle size={24} color="#EF4444" />
          <h3 style={{ margin: 0, color: '#EF4444' }}>Danger Zone: Database Nuke</h3>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Enter the Nuke Code printed in the server console to completely wipe the entire database. This deletes all users, rides, and settings permanently.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <input 
            type="text" 
            placeholder="Enter Nuke Code" 
            value={nukeCode}
            onChange={e => setNukeCode(e.target.value)}
            style={{ flex: 1, padding: '10px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
          />
          <button 
            onClick={handleNuke}
            disabled={nuking || !nukeCode.trim()}
            style={{ padding: '10px 24px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px', cursor: (nuking || !nukeCode.trim()) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (nuking || !nukeCode.trim()) ? 0.5 : 1 }}
          >
            {nuking ? 'Nuking...' : 'WIPE DATABASE'}
          </button>
        </div>
      </div>
    </div>
  );
}
