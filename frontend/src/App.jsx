import { useState } from 'react';
import UploadForm from './components/UploadForm';
import StatsSummary from './components/StatsSummary';
import RideHeader from './components/RideHeader';
import RideChart from './components/RideChart';
import Histograms from './components/Histograms';
import { analyzeRide } from './api/client';
import { Activity, Settings, X } from 'lucide-react';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [currentParams, setCurrentParams] = useState(null);

  const handleAnalyze = async (file, params, auxFile = null) => {
    if (file === currentFile && JSON.stringify(params) === JSON.stringify(currentParams) && data && !auxFile) {
      setShowModal(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await analyzeRide(file, params, auxFile);
      setData(result);
      setCurrentFile(file);
      setCurrentParams(params);
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '12px 24px', 
        backgroundColor: 'var(--bg-card)', 
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '32px' }} />
          <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
            <span style={{ color: '#e63946' }}>Power</span> Estimator
          </h1>
        </div>
      </header>

      <main style={{ padding: '24px', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {error && (
          <div className="glass-panel animate-fade-in" style={{ backgroundColor: 'rgba(255, 71, 87, 0.1)', borderColor: 'var(--accent)', marginBottom: '24px', padding: '16px' }}>
            <p style={{ color: 'var(--accent)', margin: 0, fontWeight: 600 }}>Error: {error}</p>
          </div>
        )}

        {!data && !loading && (
          <div style={{ maxWidth: '600px', margin: '4vh auto', width: '100%' }}>
            <UploadForm onAnalyze={handleAnalyze} isLoading={loading} initialFile={currentFile} initialParams={currentParams} />
          </div>
        )}

        {loading && !data && (
           <div style={{ display: 'flex', justifyContent: 'center', margin: '10vh auto' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }} />
           </div>
        )}

        {data && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
            <RideHeader summary={data.summary} params={data.params} onEdit={() => setShowModal(true)} />
            <StatsSummary summary={data.summary} />
            <Histograms histograms={data.histograms} />
            <RideChart points={data.points} summary={data.summary} xAxisKey="distance" title="Telemetry Profile (Distance)" />
            <RideChart points={data.points} summary={data.summary} xAxisKey="time_s" title="Telemetry Profile (Time)" />
          </div>
        )}
      </main>

      {/* Settings Modal Overlay */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 11, 14, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px'
        }}>
          <div style={{ position: 'relative', maxWidth: '600px', width: '100%' }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ 
                position: 'absolute', top: '16px', right: '16px', 
                background: 'none', border: 'none', color: 'var(--text-secondary)', 
                cursor: 'pointer', zIndex: 10, padding: '8px' 
              }}
            >
              <X size={20} />
            </button>
            <UploadForm onAnalyze={handleAnalyze} isLoading={loading} initialFile={currentFile} initialParams={currentParams} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
