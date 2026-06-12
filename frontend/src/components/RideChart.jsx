import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceDot, ReferenceLine } from 'recharts';

export default function RideChart({ points, summary, xAxisKey = "distance", title = "Telemetry Profile" }) {
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!points || points.length === 0) return null;

  const formatTime = (seconds) => {
    if (seconds === undefined || isNaN(seconds)) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {xAxisKey === 'time_s' ? (
            <>
              <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>Time: {formatTime(label)}</p>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Distance: {Number(p.distance).toFixed(2)} km</p>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>Distance: {Number(label).toFixed(2)} km</p>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Time: {formatTime(p.time_s)}</p>
            </>
          )}
          {payload.map((entry, i) => (
            <p key={i} style={{ margin: '4px 0', color: entry.color, fontSize: '0.9rem', fontWeight: 500 }}>
              {entry.name}: {Number(entry.value).toFixed(0)} {entry.unit}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const validPoints = points.filter(p => p.power !== null && p.speed !== null);
  const maxPower = validPoints.length ? Math.max(...validPoints.map(p => p.power)) : 0;
  const maxPowerPt = validPoints.find(p => p.power === maxPower);
  
  const maxSpeed = validPoints.length ? Math.max(...validPoints.map(p => p.speed)) : 0;
  const maxSpeedPt = validPoints.find(p => p.speed === maxSpeed);
  
  const maxEle = validPoints.length ? Math.max(...validPoints.map(p => p.elevation)) : 0;
  const maxElePt = validPoints.find(p => p.elevation === maxEle);

  const minEle = validPoints.length ? Math.min(...validPoints.map(p => p.elevation)) : 0;
  const minElePt = validPoints.find(p => p.elevation === minEle);

  // Gradient peaks
  const maxGradPt = validPoints.reduce((prev, current) => (prev && prev.gradient > current.gradient) ? prev : current, validPoints[0]);
  const minGradPt = validPoints.reduce((prev, current) => (prev && prev.gradient < current.gradient) ? prev : current, validPoints[0]);

  const hasHR = validPoints.length > 0 && validPoints.some(p => p.hr != null);
  const hrValues = validPoints.map(p => p.hr).filter(v => v != null);
  const maxHR = hasHR && hrValues.length ? Math.max(...hrValues) : 0;
  const minHR = hasHR && hrValues.filter(v => v > 0).length ? Math.min(...hrValues.filter(v => v > 0)) : 0;
  const maxHRPt = hasHR ? validPoints.find(p => p.hr === maxHR) : null;
  const minHRPt = hasHR && minHR > 0 ? validPoints.find(p => p.hr === minHR) : null;

  const cadValues = validPoints.map(p => p.cad).filter(v => v != null);
  const hasCad = cadValues.length > 0 && cadValues.some(v => v > 0);
  const maxCad = hasCad ? Math.max(...cadValues) : 0;
  const maxCadPt = hasCad ? validPoints.find(p => p.cad === maxCad) : null;

  const displayPoints = React.useMemo(() => {
    if (!points || points.length === 0) return [];
    if (!isMobile) return points;
    
    const criticalTime = new Set([
      maxPowerPt, maxSpeedPt, maxElePt, minElePt, maxHRPt, minHRPt, maxCadPt, maxGradPt, minGradPt
    ].filter(Boolean).map(p => p.time_s));

    const bucketSize = 8;
    const result = [];
    let currentChunk = [];
    
    const averageChunk = (chunk) => {
      if (chunk.length === 1) return chunk[0];
      const avgPoint = { ...chunk[Math.floor(chunk.length / 2)] };
      let sumPower = 0, sumSpeed = 0, sumEle = 0, sumHR = 0, sumCad = 0;
      let countHR = 0, countCad = 0;
      
      chunk.forEach(p => {
        sumPower += p.power || 0;
        sumSpeed += p.speed || 0;
        sumEle += p.elevation || 0;
        if (p.hr != null) { sumHR += p.hr; countHR++; }
        if (p.cad != null) { sumCad += p.cad; countCad++; }
      });
      
      avgPoint.power = sumPower / chunk.length;
      avgPoint.speed = sumSpeed / chunk.length;
      avgPoint.elevation = sumEle / chunk.length;
      if (countHR > 0) avgPoint.hr = sumHR / countHR;
      if (countCad > 0) avgPoint.cad = sumCad / countCad;
      return avgPoint;
    };
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const prevP = i > 0 ? points[i - 1] : null;
      
      const isTimeGap = prevP && (p.time_s - prevP.time_s > 30);
      const isPauseEdge = prevP && ((p.speed < 0.5) !== (prevP.speed < 0.5));
      
      // Flush chunks on gaps or edges of pauses to completely protect flatlines from smearing
      if (isTimeGap || isPauseEdge) {
        if (currentChunk.length > 0) {
          result.push(averageChunk(currentChunk));
          currentChunk = [];
        }
        result.push(prevP);
        result.push(p);
        continue;
      }
      
      currentChunk.push(p);
      
      if (currentChunk.length >= bucketSize) {
        result.push(averageChunk(currentChunk));
        currentChunk = [];
      }
    }
    
    if (currentChunk.length > 0) {
      result.push(averageChunk(currentChunk));
    }
    
    // Explicitly add global extrema using unique time identifiers
    points.forEach(p => {
        if (criticalTime.has(p.time_s)) {
            result.push(p);
        }
    });
    
    // Sort to ensure monotonic X-axis so Recharts doesn't glitch. If X is same (e.g. paused at same distance), sort by time to preserve vertical order!
    result.sort((a, b) => {
        if (a[xAxisKey] === b[xAxisKey]) {
            return a.time_s - b.time_s;
        }
        return a[xAxisKey] - b[xAxisKey];
    });
    
    // Deduplicate exact chronologically identical points
    const deduped = [];
    for (let i = 0; i < result.length; i++) {
        if (i === 0 || result[i].time_s !== result[i-1].time_s) {
            deduped.push(result[i]);
        }
    }
    return deduped;
  }, [points, isMobile, xAxisKey, maxPowerPt, maxSpeedPt, maxElePt, minElePt, maxHRPt, minHRPt, maxCadPt, maxGradPt, minGradPt]);

  return (
    <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.4s', height: '400px', padding: '24px', marginBottom: '24px' }}>
      <h3 style={{ marginLeft: '0px', marginBottom: '16px' }}>{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart key={isMobile ? 'mobile' : 'desktop'} data={displayPoints} margin={{ top: 35, right: isMobile ? 0 : 25, bottom: 15, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          
          <XAxis 
            dataKey={xAxisKey} 
            type="number" 
            tickFormatter={(v) => xAxisKey === "time_s" ? formatTime(v) : v.toFixed(0)} 
            stroke="var(--text-secondary)"
            domain={['dataMin', 'dataMax']}
            tickCount={10}
            axisLine={false}
            tickLine={false}
          />
          
          <YAxis 
            yAxisId="power" 
            orientation="left" 
            stroke="var(--power-color)"
            domain={[0, 'auto']}
            tickFormatter={(v) => v.toFixed(0)}
            axisLine={false}
            tickLine={false}
            hide={isMobile}
          />
          
          <YAxis 
            yAxisId="speed" 
            orientation="right" 
            stroke="var(--speed-color)"
            domain={[0, 'auto']}
            tickFormatter={(v) => v.toFixed(0)}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 0 : 40}
            tick={isMobile ? false : {fontSize: 10, fill: "var(--speed-color)"}}
          />
          
          <YAxis 
            yAxisId="elevation" 
            orientation="right" 
            domain={['auto', 'auto']}
            axisLine={false}
            tickLine={false}
            width={0}
            tick={false}
          />
          
          {hasHR && (
            <YAxis 
              yAxisId="hr" 
              orientation="right" 
              domain={[0, 'auto']}
              axisLine={false}
              tickLine={false}
              width={0}
              tick={false}
            />
          )}

          {hasCad && (
            <YAxis 
              yAxisId="cad" 
              orientation="right" 
              stroke="var(--cad-color)"
              domain={[0, 'auto']}
              hide={isMobile}
              tick={{fontSize: 10}}
            />
          )}

          <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
          <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
          
          <ReferenceLine y={maxEle} yAxisId="elevation" stroke="var(--text-secondary)" strokeDasharray="3 3" opacity={0.3} />
          <ReferenceLine y={minEle} yAxisId="elevation" stroke="var(--text-secondary)" strokeDasharray="3 3" opacity={0.3} />
          {minElePt && <ReferenceLine x={minElePt[xAxisKey]} yAxisId="elevation" stroke="var(--text-secondary)" opacity={0.4} label={{ position: 'center', value: `${Math.round(maxEle - minEle)}m diff`, fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} />}
          
          {summary?.avg_power_w && <ReferenceLine y={summary.avg_power_w} yAxisId="power" stroke="rgba(255, 211, 42, 0.8)" strokeDasharray="4 4" label={{ position: 'insideTopRight', value: `Avg Power ${Math.round(summary.avg_power_w)}W`, fill: 'rgba(255, 211, 42, 1)', fontSize: 10, fontWeight: 600 }} />}
          {summary?.avg_speed_kmh && <ReferenceLine y={summary.avg_speed_kmh} yAxisId="speed" stroke="rgba(72, 219, 251, 0.8)" strokeDasharray="4 4" label={{ position: 'insideBottomRight', value: `Avg Speed ${Math.round(summary.avg_speed_kmh)} km/h`, fill: 'rgba(72, 219, 251, 1)', fontSize: 10, fontWeight: 600 }} />}
          {hasHR && summary?.avg_hr_bpm && <ReferenceLine y={summary.avg_hr_bpm} yAxisId="hr" stroke="rgba(255, 159, 243, 0.8)" strokeDasharray="4 4" label={{ position: 'insideTopRight', value: `Avg HR ${Math.round(summary.avg_hr_bpm)} bpm`, fill: 'rgba(255, 159, 243, 1)', fontSize: 10, fontWeight: 600 }} />}
          
          {maxPowerPt && <ReferenceDot x={maxPowerPt[xAxisKey]} y={maxPower} yAxisId="power" r={5} fill="#cc7a29" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Max Power ${Math.round(maxPower)}W`, fill: '#cc7a29', fontSize: 10, fontWeight: 600 }} />}
          {maxSpeedPt && <ReferenceDot x={maxSpeedPt[xAxisKey]} y={maxSpeed} yAxisId="speed" r={5} fill="#1873cc" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Max Speed ${Math.round(maxSpeed)} km/h`, fill: '#1873cc', fontSize: 10, fontWeight: 600 }} />}
          {maxElePt && <ReferenceDot x={maxElePt[xAxisKey]} y={maxEle} yAxisId="elevation" r={5} fill="#25aa5c" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Max Elevation ${Math.round(maxEle)}m`, fill: '#25aa5c', fontSize: 10, fontWeight: 600 }} />}
          {minElePt && <ReferenceDot x={minElePt[xAxisKey]} y={minEle} yAxisId="elevation" r={5} fill="#25aa5c" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Min Elevation ${Math.round(minEle)}m`, fill: '#25aa5c', fontSize: 10, fontWeight: 600 }} />}
          {maxHRPt && <ReferenceDot x={maxHRPt[xAxisKey]} y={maxHR} yAxisId="hr" r={5} fill="#cc5567" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Max HR ${Math.round(maxHR)} bpm`, fill: '#cc5567', fontSize: 10, fontWeight: 600 }} />}
          {minHRPt && <ReferenceDot x={minHRPt[xAxisKey]} y={minHR} yAxisId="hr" r={5} fill="#cc5567" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'bottom', value: `Min HR ${Math.round(minHR)} bpm`, fill: '#cc5567', fontSize: 10, fontWeight: 600 }} />}
          {maxCadPt && <ReferenceDot x={maxCadPt[xAxisKey]} y={maxCad} yAxisId="cad" r={5} fill="#bda353" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Max Cadence ${Math.round(maxCad)} rpm`, fill: '#bda353', fontSize: 10, fontWeight: 600 }} />}
          
          {maxGradPt && <ReferenceDot x={maxGradPt[xAxisKey]} y={maxGradPt.elevation} yAxisId="elevation" r={5} fill="#25aa5c" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'top', value: `Max Climb ${(maxGradPt.gradient*100).toFixed(1)}%`, fill: '#25aa5c', fontSize: 10, fontWeight: 600 }} />}
          {minGradPt && <ReferenceDot x={minGradPt[xAxisKey]} y={minGradPt.elevation} yAxisId="elevation" r={5} fill="#25aa5c" stroke="var(--bg-card)" strokeWidth={2} label={isMobile ? false : { position: 'bottom', value: `Max Descent ${(minGradPt.gradient*100).toFixed(1)}%`, fill: '#25aa5c', fontSize: 10, fontWeight: 600 }} />}
          
          <Area 
            yAxisId="elevation" 
            type="monotone" 
            dataKey="elevation" 
            name="Elevation" 
            unit="m"
            fill="rgba(46, 213, 115, 0.15)" 
            stroke="var(--elevation-color)" 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={true}
            connectNulls={false}
          />
          
          <Line 
            yAxisId="power" 
            type="monotone" 
            dataKey="power" 
            name="Power" 
            unit="W"
            stroke="var(--power-color)" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={true}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
          
          <Line 
            yAxisId="speed" 
            type="monotone" 
            dataKey="speed" 
            name="Speed" 
            unit="km/h"
            stroke="var(--speed-color)" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={true}
            connectNulls={false}
          />
          
          {hasHR && (
            <Line 
              yAxisId="hr" 
              type="monotone" 
              dataKey="hr" 
              name="Heart Rate" 
              unit="bpm"
              stroke="var(--hr-color)" 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={true}
              connectNulls={false}
            />
          )}

          {hasCad && (
            <Line 
              yAxisId="cad" 
              type="monotone" 
              dataKey="cad" 
              name="Cadence" 
              unit="rpm"
              stroke="var(--cad-color)" 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={true}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
