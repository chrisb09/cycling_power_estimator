import React, { useState, useRef } from 'react';
import { UploadCloud, Bike, Weight, Settings } from 'lucide-react';

export default function UploadForm({ onAnalyze, isLoading, initialFile = null, initialParams = null }) {
  const [file, setFile] = useState(initialFile);
  const [auxFile, setAuxFile] = useState(null);
  const [params, setParams] = useState(initialParams || {
    rider_kg: 75.0,
    bike_kg: 10.0,
    tires: 'commuter',
    position: 'hoods',
    drivetrain: 'average'
  });
  
  const fileInputRef = useRef(null);
  const auxFileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAuxFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setAuxFile(e.target.files[0]);
    }
  };

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setParams(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file) {
      onAnalyze(file, params, auxFile);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Settings size={18} color="var(--accent)" /> Parameters
      </h3>
      
      <div 
        className={`file-drop-area ${file ? 'has-file' : ''}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="file-drop-icon" size={28} />
        {file ? (
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{file.name}</p>
        ) : (
          <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>Click or drag to upload GPX file</p>
        )}
        <input 
          type="file" 
          accept=".gpx" 
          style={{ display: 'none' }} 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>

      <div 
        className={`file-drop-area ${auxFile ? 'has-file' : ''}`}
        onClick={() => auxFileInputRef.current?.click()}
        style={{ marginTop: '12px', minHeight: '80px', padding: '12px' }}
      >
        {auxFile ? (
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{auxFile.name}</p>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', margin: '0 0 4px 0', color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>Optional:</strong> Upload a secondary GPX file</p>
            <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-secondary)', opacity: 0.8 }}>If your primary file is missing altitude, we will automatically extract the elevation data from this file by aligning the GPS trajectories.</p>
          </div>
        )}
        <input 
          type="file" 
          accept=".gpx" 
          style={{ display: 'none' }} 
          ref={auxFileInputRef}
          onChange={handleAuxFileChange}
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

      <button 
        type="submit" 
        className="btn-primary" 
        disabled={!file || isLoading}
        style={{ width: '100%', marginTop: '16px' }}
      >
        {isLoading ? <div className="spinner" /> : "Calculate Power"}
      </button>
    </form>
  );
}
