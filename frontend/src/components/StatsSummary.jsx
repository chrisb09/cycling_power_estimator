import React from 'react';
import { Route, Clock, Activity, Zap, TrendingUp, Mountain, Info, Heart, RotateCcw } from 'lucide-react';

export default function StatsSummary({ summary }) {
  if (!summary) return null;

  const formatDuration = (seconds) => {
    if (seconds === undefined) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const statGroups = [
    {
      title: "Speed",
      items: [
        { label: "Avg Speed", value: `${summary.avg_speed_kmh.toFixed(1)} km/h`, icon: Activity, color: "#1e90ff", tooltip: "Total distance / Total elapsed time." },
        { label: "Avg Moving Speed", value: `${summary.avg_moving_speed_kmh.toFixed(1)} km/h`, icon: Activity, color: "#1e90ff", tooltip: "Total distance / Moving time." },
        { label: "Top Speed", value: `${summary.max_speed_kmh.toFixed(1)} km/h`, icon: Zap, color: "#1e90ff", tooltip: "Maximum recorded speed." }
      ]
    },
    {
      title: "Power & Energy",
      items: [
        { label: "Avg Power", value: `${Math.round(summary.avg_power_w)} W`, icon: Activity, color: "#ff9f43", tooltip: "Average mechanical power output while moving." },
        { label: "Work (kWh)", value: `${summary.total_work_kwh.toFixed(2)} kWh`, icon: TrendingUp, color: "#2ed573", tooltip: "Total mechanical work done in Kilowatt-hours." },
        { label: "Energy", value: `${Math.round(summary.energy_kcal)} kcal`, icon: TrendingUp, color: "#ff4757", tooltip: "Estimated calories burned. Assumes human gross metabolic efficiency is roughly 24%, meaning 1 kJ of mechanical work equals ~1 kcal of metabolic energy." },
      ]
    },
    {
      title: "Elevation",
      items: [
        { label: "Elevation Gain", value: `${Math.round(summary.elevation_gain_m)} m`, icon: Mountain, color: "#9c88ff", tooltip: "Total vertical meters climbed." },
        { label: "Elevation Drop", value: `${Math.round(summary.elevation_loss_m)} m`, icon: Mountain, color: "#ff4757", tooltip: "Total vertical meters descended." }
      ]
    }
  ];

  if (summary.avg_hr_bpm || summary.avg_cad_rpm) {
    const bioItems = [];
    if (summary.avg_hr_bpm) {
      bioItems.push({ label: "Avg Heart Rate", value: `${Math.round(summary.avg_hr_bpm)} bpm`, icon: Heart, color: "#ff6b81", tooltip: "Average heart rate while moving." });
      bioItems.push({ label: "Max Heart Rate", value: `${Math.round(summary.max_hr_bpm)} bpm`, icon: Heart, color: "#ff6b81", tooltip: "Peak heart rate recorded." });
      bioItems.push({ label: "Min Heart Rate", value: `${Math.round(summary.min_hr_bpm)} bpm`, icon: Heart, color: "#ff6b81", tooltip: "Lowest heart rate recorded while moving." });
    }
    if (summary.avg_cad_rpm) {
      bioItems.push({ label: "Avg Cadence", value: `${Math.round(summary.avg_cad_rpm)} rpm`, icon: RotateCcw, color: "#eccc68", tooltip: "Average pedaling cadence while moving." });
      bioItems.push({ label: "Max Cadence", value: `${Math.round(summary.max_cad_rpm)} rpm`, icon: RotateCcw, color: "#eccc68", tooltip: "Peak pedaling cadence recorded." });
    }
    statGroups.push({
      title: "Biometrics & Cadence",
      items: bioItems
    });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '24px' }}>
      {statGroups.map((group, gIdx) => (
        <div key={gIdx} className="glass-panel animate-fade-in" style={{ padding: '20px', animationDelay: `${0.1 + gIdx*0.1}s` }}>
          <h3 style={{ margin: '0 0 12px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '1.05rem' }}>{group.title}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {group.items.map((stat, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <stat.icon size={14} color={stat.color} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {stat.label}
                    <span title={stat.tooltip} style={{ cursor: 'help', display: 'flex' }}>
                      <Info size={12} color="var(--text-secondary)" style={{ opacity: 0.6 }} />
                    </span>
                  </span>
                </div>
                <span style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem' }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
