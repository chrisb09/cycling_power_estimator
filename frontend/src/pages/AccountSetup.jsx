import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMe, updateMe } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { User, Weight, MapPin } from 'lucide-react';

export default function AccountSetup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [location, setLocation] = useState('');
  const [weight, setWeight] = useState(75.0);
  const [height, setHeight] = useState(175.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchMe().then(user => {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setLocation(user.location || '');
      setWeight(user.weight_kg || 75.0);
      setHeight(user.height_cm || 175.0);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      navigate('/dashboard');
    });
  }, [token, navigate]);

  const [profilePicFile, setProfilePicFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = React.useRef(null);
  
  const handlePicUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePicFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMe({
        first_name: firstName,
        last_name: lastName,
        location: location,
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height)
      });
      if (profilePicFile) {
        const { uploadProfilePicture } = await import('../api/client');
        await uploadProfilePicture(profilePicFile);
      }
      navigate('/dashboard');
    } catch (err) {
      alert(err.message);
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '40px 32px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', textAlign: 'center', color: 'var(--primary)' }}>Welcome!</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '32px' }}>Let's set up your rider profile before you start analyzing rides.</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={32} color="var(--text-secondary)" />
              )}
            </div>
            <div>
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} ref={fileInputRef} onChange={handlePicUpload} />
              <button type="button" className="button" onClick={() => fileInputRef.current.click()} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 16px', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}>
                {profilePicFile ? "Change Selection" : "Upload Picture"}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>First Name (Optional)</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', padding: '10px' }} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Last Name (Optional)</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', padding: '10px' }} />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} /> Location (Optional)</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London, UK" style={{ width: '100%', padding: '10px' }} />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', gap: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Weight size={16} /> Body Weight (kg)</label>
              <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} required style={{ width: '100%', padding: '10px' }} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Height (cm)</label>
              <input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} required style={{ width: '100%', padding: '10px' }} />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '12px', marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            {saving ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}/> : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
