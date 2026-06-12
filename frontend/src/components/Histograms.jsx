import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function Histograms({ histograms }) {
  if (!histograms || !histograms.power_time) return null;

  const CustomTooltip = ({ active, payload, label, unit }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>{label}</p>
          <p style={{ margin: 0, color: payload[0].fill }}>{Number(payload[0].value).toFixed(1)} {unit}</p>
        </div>
      );
    }
    return null;
  };

  const ChartBlock = ({ title, data, color, unit }) => (
    <div className="glass-panel animate-fade-in" style={{ height: '220px', padding: '16px' }}>
      <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis dataKey="bin" tick={{fontSize: 10}} stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
          <YAxis stroke="var(--text-secondary)" tick={{fontSize: 10}} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(0)} />
          <Tooltip content={<CustomTooltip unit={unit} />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '24px' }}>
      <ChartBlock title="Power by Time (Minutes)" data={histograms.power_time} color="var(--power-color)" unit="min" />
      <ChartBlock title="Speed by Time (Minutes)" data={histograms.speed_time} color="var(--speed-color)" unit="min" />
      <ChartBlock title="Speed by Distance (km)" data={histograms.speed_dist} color="var(--speed-color)" unit="km" />
      {histograms.hr_time && histograms.hr_time.length > 0 && (
        <ChartBlock title="Heart Rate by Time (Minutes)" data={histograms.hr_time} color="var(--hr-color)" unit="min" />
      )}
    </div>
  );
}
