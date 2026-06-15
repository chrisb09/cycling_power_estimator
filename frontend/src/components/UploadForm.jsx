import React, { useState, useRef, useEffect, useContext } from 'react';
import { UploadCloud, Bike, Weight, Settings, Eye } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { fetchMe } from '../api/client';

export default function UploadForm({ onAnalyze, isLoading, initialFile = null, initialAuxFile = null, initialParams = null, isEditingSavedRide = false, savedFileName = null, savedAuxFileName = null }) {
  const [file, setFile] = useState(initialFile);
  const [auxFile, setAuxFile] = useState(initialAuxFile);
  const [params, setParams] = useState(initialParams || {
    rider_kg: 75.0,
    bike_kg: 10.0,
    tires: 'commuter',
    position: 'hoods',
    drivetrain: 'average',
    visibility: 'private'
  });
  const { token } = useContext(AuthContext);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isAuxDragging, setIsAuxDragging] = useState(false);
  
  const primaryRef = useRef(null);
  const auxRef = useRef(null);

  useEffect(() => {
    if (token && !initialParams) {
      fetchMe().then(user => {
        setParams(p => ({ 
          ...p, 
          rider_kg: user.weight_kg || p.rider_kg,
          height_cm: user.height_cm || p.height_cm,
          visibility: user.default_ride_visibility || 'private'
        }));
      }).catch(err => console.error("Failed to load user defaults", err));
    }
  }, [token, initialParams]);

  // Use NATIVE event listeners for maximum resilience against OS/Browser integration bugs
  useEffect(() => {
    const el = primaryRef.current;
    if (!el) return;
    
    const handleChange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        setFile(e.target.files[0]);
      }
      setIsDragging(false);
    };
    
    const handleDragEnter = () => setIsDragging(true);
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = () => setIsDragging(false);

    el.addEventListener('change', handleChange);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
    
    return () => {
      el.removeEventListener('change', handleChange);
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    const el = auxRef.current;
    if (!el) return;
    
    const handleChange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        setAuxFile(e.target.files[0]);
      }
      setIsAuxDragging(false);
    };
    
    const handleDragEnter = () => setIsAuxDragging(true);
    const handleDragLeave = () => setIsAuxDragging(false);
    const handleDrop = () => setIsAuxDragging(false);

    el.addEventListener('change', handleChange);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
    
    return () => {
      el.removeEventListener('change', handleChange);
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setParams(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file || isEditingSavedRide) {
      onAnalyze(file, params, auxFile);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Settings size={18} color="var(--accent)" /> Parameters
      </h3>
      
      <div 
        className={`file-drop-area ${file || isEditingSavedRide ? 'has-file' : ''} ${isDragging ? 'drag-over' : ''}`}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <UploadCloud className="file-drop-icon" size={28} style={{ color: (isEditingSavedRide && !file) ? 'var(--primary)' : undefined }} />
        {file ? (
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0, color: 'var(--primary)', wordBreak: 'break-all' }}>Loaded: {file.name}</p>
        ) : isEditingSavedRide ? (
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0, color: 'var(--primary)', wordBreak: 'break-all' }}>Using saved: {savedFileName || 'Original GPX'}</p>
        ) : (
          <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>Click or drag to upload GPX file</p>
        )}
        <input 
          ref={primaryRef}
          type="file" 
          accept=".gpx"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} 
        />
      </div>

      <div 
        className={`file-drop-area ${auxFile ? 'has-file' : ''} ${isAuxDragging ? 'drag-over' : ''}`}
        style={{ marginTop: '12px', minHeight: '80px', padding: '12px', position: 'relative', overflow: 'hidden' }}
      >
        {auxFile ? (
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0, color: 'var(--primary)', wordBreak: 'break-all' }}>Loaded: {auxFile.name}</p>
        ) : (isEditingSavedRide && savedAuxFileName) ? (
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0, color: 'var(--primary)', wordBreak: 'break-all' }}>Using saved: {savedAuxFileName}</p>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', margin: '0 0 4px 0', color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>Optional:</strong> Upload a secondary GPX file</p>
            <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-secondary)', opacity: 0.8 }}>If your primary file is missing altitude, we will automatically extract the elevation data from this file.</p>
          </div>
        )}
        <input 
          ref={auxRef}
          type="file" 
          accept=".gpx"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} 
        />
      </div>

      <div className="grid grid-cols-2" style={{ marginTop: '16px' }}>
        <div className="form-group">
          <label><Weight size={14}/> Rider Weight (kg)</label>
          <input type="number" step="0.1" name="rider_kg" value={params.rider_kg} onChange={handleParamChange} required />
        </div>
        <div className="form-group">
          <label><Bike size={14}/> Bike Weight (kg)</label>
          <input type="number" step="0.1" name="bike_kg" value={params.bike_kg} onChange={handleParamChange} required />
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="form-group">
          <label>Tires</label>
          <select name="tires" value={params.tires} onChange={handleParamChange}>
            <option value="slick">Slick / Race (Crr: 0.004)</option>
            <option value="commuter">Commuter / Touring (Crr: 0.005)</option>
            <option value="gravel">Gravel (Crr: 0.007)</option>
            <option value="mtb">Mountain Bike (Crr: 0.010)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Riding Position</label>
          <select name="position" value={params.position} onChange={handleParamChange}>
            <option value="tops">Tops / Upright (CdA: 0.40)</option>
            <option value="hoods">Hoods / Standard (CdA: 0.32)</option>
            <option value="drops">Drops / Aggressive (CdA: 0.28)</option>
            <option value="aero">Aero / TT (CdA: 0.25)</option>
          </select>
        </div>
      </div>
      
      <div className="form-group">
        <label>Drivetrain Efficiency</label>
        <select name="drivetrain" value={params.drivetrain} onChange={handleParamChange}>
          <option value="optimized">Optimized / Waxed (97%)</option>
          <option value="average">Average / Lube (95%)</option>
          <option value="dirty">Dirty / Gritty (92%)</option>
        </select>
      </div>

      {token && (
        <div className="form-group" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Eye size={14}/> Ride Visibility</label>
          <select name="visibility" value={params.visibility} onChange={handleParamChange}>
            <option value="public">Public (Visible on your profile)</option>
            <option value="unlisted">Unlisted (Anyone with the link)</option>
            <option value="private">Private (Only you & secret link)</option>
          </select>
        </div>
      )}

      <button 
        type="submit" 
        className="btn-primary" 
        disabled={(!file && !isEditingSavedRide) || isLoading}
        style={{ width: '100%', marginTop: '16px' }}
      >
        {isLoading ? <div className="spinner" /> : "Upload & Calculate Power"}
      </button>
    </form>
  );
}
