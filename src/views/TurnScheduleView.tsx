import React, { useState } from 'react';

interface TurnScheduleViewProps {
  showToast: (title: string, desc?: string) => void;
  bedId?: string;
  isApiConnected?: boolean;
}

interface PressurePoint {
  time: string;
  pressure: number;
  zone: string;
  posture: string;
  status: 'nominal' | 'elevated' | 'critical';
  note?: string;
}

export const TurnScheduleView: React.FC<TurnScheduleViewProps> = ({
  showToast,
  bedId = 'bed-07',
  isApiConnected = false,
}) => {
  const [timeRange, setTimeRange] = useState<'8h' | '24h' | '7d'>('8h');
  const [selectedPoint, setSelectedPoint] = useState<PressurePoint | null>(null);

  // Pressure history data points for Last 8 Hours
  const data8h: PressurePoint[] = [
    { time: '06:00', pressure: 16, zone: 'Back (Thoracic)', posture: 'Supine', status: 'nominal', note: 'Morning vitals check' },
    { time: '07:00', pressure: 22, zone: 'Sacrum', posture: 'Supine', status: 'nominal' },
    { time: '08:00', pressure: 48, zone: 'Sacrum', posture: 'Supine', status: 'elevated', note: 'Dwell accumulation' },
    { time: '08:30', pressure: 14, zone: 'Left Trochanter', posture: 'Left 30° Lateral', status: 'nominal', note: 'Turned by RN Kowalski' },
    { time: '09:00', pressure: 26, zone: 'Left Trochanter', posture: 'Left 30° Lateral', status: 'nominal' },
    { time: '09:30', pressure: 68, zone: 'Left Trochanter', posture: 'Left 30° Lateral', status: 'critical', note: 'Focal peak alert' },
    { time: '09:45', pressure: 18, zone: 'Right Trochanter', posture: 'Right 30° Lateral', status: 'nominal', note: 'Turned by RN Nygård' },
    { time: '10:30', pressure: 24, zone: 'Right Trochanter', posture: 'Right 30° Lateral', status: 'nominal' },
    { time: '11:30', pressure: 29, zone: 'Right Trochanter', posture: 'Right 30° Lateral', status: 'nominal' },
    { time: '11:45', pressure: 15, zone: 'Back', posture: 'Supine 15° Tilt', status: 'nominal', note: 'Repositioned' },
    { time: '12:30', pressure: 21, zone: 'Sacrum', posture: 'Supine 15° Tilt', status: 'nominal' },
    { time: '13:15', pressure: 38, zone: 'Sacrum', posture: 'Supine 15° Tilt', status: 'elevated' },
    { time: '13:45', pressure: 19, zone: 'Left Trochanter', posture: 'Left 30° Lateral', status: 'nominal', note: 'Turned on schedule' },
  ];

  const handleExportCSV = () => {
    const csvRows = [
      'Timestamp,Zone,Pressure_mmHg,Posture,Status,Note',
      ...data8h.map((p) => `${p.time},${p.zone},${p.pressure},${p.posture},${p.status},"${p.note || ''}"`),
    ].join('\n');

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvRows);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Perfusense_Pressure_History_Bed07_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('PRESSURE HISTORY EXPORTED', `Downloaded CSV for ${timeRange} range.`);
  };

  // SVG Chart Geometry
  const chartHeight = 200;
  const chartWidth = 760;
  const paddingX = 40;
  const paddingY = 25;
  const maxPressure = 80;

  const getX = (index: number) => {
    return paddingX + (index / (data8h.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    return chartHeight - paddingY - (val / maxPressure) * (chartHeight - paddingY * 2);
  };

  // Build SVG path
  const points = data8h.map((p, i) => `${getX(i)},${getY(p.pressure)}`).join(' ');
  const areaPoints = `${getX(0)},${chartHeight - paddingY} ${points} ${getX(data8h.length - 1)},${chartHeight - paddingY}`;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 select-none w-full max-w-[1300px] mx-auto">
      {/* Clean Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#EDE8DC] p-3 sm:p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
            <h1 className="font-headline-lg text-[#121c1b] uppercase tracking-tight font-bold text-sm sm:text-lg">
              PRESSURE HISTORY
            </h1>
          </div>
          <p className="font-body-sm text-[#3f4947] text-[11px] sm:text-xs mt-0.5">
            BED 07 // Eleanor Vance (#8942-01) // Continuous trend &amp; offload log.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Time range selector */}
          <div className="flex items-center bg-[#ffffff] border-[2px] border-[#121c1b] p-0.5 shadow-[1px_1px_0px_#121c1b]">
            <button
              onClick={() => setTimeRange('8h')}
              className={`px-2.5 sm:px-3 py-1 font-label-mono-sm text-[11px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${
                timeRange === '8h' ? 'bg-[#1d635d] text-white' : 'text-[#121c1b] hover:bg-[#ebf6f4]'
              }`}
            >
              8H
            </button>
            <button
              onClick={() => setTimeRange('24h')}
              className={`px-2.5 sm:px-3 py-1 font-label-mono-sm text-[11px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${
                timeRange === '24h' ? 'bg-[#1d635d] text-white' : 'text-[#121c1b] hover:bg-[#ebf6f4]'
              }`}
            >
              24H
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 sm:px-3 py-1 font-label-mono-sm text-[11px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${
                timeRange === '7d' ? 'bg-[#1d635d] text-white' : 'text-[#121c1b] hover:bg-[#ebf6f4]'
              }`}
            >
              7D
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-[#1d635d] text-white border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-xs font-bold uppercase transition-all neo-btn flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-none"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-[#ffffff] p-2.5 sm:p-3.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
          <div className="font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] uppercase font-bold">
            CURRENT PRESSURE
          </div>
          <div className="font-headline-lg text-base sm:text-lg text-[#1d635d] font-bold mt-1">
            19 <span className="text-xs font-normal text-[#121c1b]">mmHg</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#3f4947] mt-0.5 font-label-mono-sm truncate">
            Optimal (Left Lateral)
          </div>
        </div>

        <div className="bg-[#ffffff] p-2.5 sm:p-3.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
          <div className="font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] uppercase font-bold">
            MAX RECORDED PEAK
          </div>
          <div className="font-headline-lg text-base sm:text-lg text-[#8b2635] font-bold mt-1">
            68.4 <span className="text-xs font-normal text-[#121c1b]">mmHg</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#8b2635] mt-0.5 font-label-mono-sm font-bold truncate">
            09:30 (Sacrum hot spot)
          </div>
        </div>

        <div className="bg-[#ffffff] p-2.5 sm:p-3.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
          <div className="font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] uppercase font-bold">
            AVERAGE PRESSURE
          </div>
          <div className="font-headline-lg text-base sm:text-lg text-[#121c1b] font-bold mt-1">
            24.2 <span className="text-xs font-normal text-[#121c1b]">mmHg</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#1d635d] mt-0.5 font-label-mono-sm font-bold truncate">
            Below capillary limit
          </div>
        </div>

        <div className="bg-[#ffffff] p-2.5 sm:p-3.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
          <div className="font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] uppercase font-bold">
            ON-TIME TURNS
          </div>
          <div className="font-headline-lg text-base sm:text-lg text-[#1d635d] font-bold mt-1">
            4 / 4 <span className="text-xs font-normal text-[#121c1b]">(100%)</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[#1d635d] mt-0.5 font-label-mono-sm font-bold truncate">
            Fully compliant
          </div>
        </div>
      </div>

      {/* Pressure Trend Graph Card */}
      <div className="bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 pb-2 border-b border-[#121c1b]/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1d635d] text-[20px]">trending_up</span>
            <span className="font-headline-sm font-bold text-xs sm:text-sm text-[#121c1b] uppercase">
              PRESSURE TIMELINE ({timeRange.toUpperCase()})
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-label-mono-sm">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-[#d97757]"></span>
              <span className="text-[9px] sm:text-[10px] text-[#3f4947]">32 mmHg Capillary</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-[#8b2635]"></span>
              <span className="text-[9px] sm:text-[10px] text-[#8b2635] font-bold">55 mmHg Ischemic</span>
            </span>
          </div>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between text-[10px] text-[#1d635d] font-label-mono-sm bg-[#ebf6f4] px-2 py-1 border border-[#121c1b]/20">
          <span>SWIPE GRAPH HORIZONTALLY</span>
          <span className="material-symbols-outlined text-[14px]">swipe</span>
        </div>

        {/* SVG Chart Container */}
        <div className="w-full overflow-x-auto touch-pan-x">
          <div className="min-w-[620px] sm:min-w-[680px]">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 sm:h-48 select-none">
              {/* Background horizontal grid lines */}
              <line x1={paddingX} y1={getY(0)} x2={chartWidth - paddingX} y2={getY(0)} stroke="#121c1b" strokeWidth="1" opacity="0.2" />
              <line x1={paddingX} y1={getY(20)} x2={chartWidth - paddingX} y2={getY(20)} stroke="#121c1b" strokeWidth="1" opacity="0.1" strokeDasharray="3,3" />
              <line x1={paddingX} y1={getY(40)} x2={chartWidth - paddingX} y2={getY(40)} stroke="#121c1b" strokeWidth="1" opacity="0.1" strokeDasharray="3,3" />
              <line x1={paddingX} y1={getY(60)} x2={chartWidth - paddingX} y2={getY(60)} stroke="#121c1b" strokeWidth="1" opacity="0.1" strokeDasharray="3,3" />

              {/* Threshold Lines */}
              {/* 32 mmHg Capillary Line */}
              <line
                x1={paddingX}
                y1={getY(32)}
                x2={chartWidth - paddingX}
                y2={getY(32)}
                stroke="#d97757"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <text x={chartWidth - paddingX + 4} y={getY(32) + 3} fill="#d97757" fontSize="9" fontFamily="monospace">
                32
              </text>

              {/* 55 mmHg Critical Line */}
              <line
                x1={paddingX}
                y1={getY(55)}
                x2={chartWidth - paddingX}
                y2={getY(55)}
                stroke="#8b2635"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <text x={chartWidth - paddingX + 4} y={getY(55) + 3} fill="#8b2635" fontSize="9" fontFamily="monospace" fontWeight="bold">
                55
              </text>

              {/* Shaded Area */}
              <polygon points={areaPoints} fill="#1d635d" fillOpacity="0.12" />

              {/* Line Graph */}
              <polyline points={points} fill="none" stroke="#1d635d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data points */}
              {data8h.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.pressure);
                const isCrit = p.status === 'critical';
                const isWarn = p.status === 'elevated';
                let dotFill = '#1d635d';
                if (isCrit) dotFill = '#8b2635';
                else if (isWarn) dotFill = '#d97757';

                return (
                  <g key={i} className="cursor-pointer" onClick={() => setSelectedPoint(p)}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isCrit ? 6 : 4}
                      fill={dotFill}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="hover:scale-150 transition-transform"
                    />
                    {p.note && (
                      <rect
                        x={cx - 3}
                        y={cy - 12}
                        width="6"
                        height="6"
                        fill="#121c1b"
                        transform={`rotate(45, ${cx}, ${cy - 9})`}
                      />
                    )}
                    {/* Time Label on bottom axis */}
                    <text
                      x={cx}
                      y={chartHeight - 6}
                      fill="#3f4947"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {p.time}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Selected Data Point Detail Box */}
        {selectedPoint ? (
          <div className="bg-[#ebf6f4] p-2.5 sm:p-3 border-[2px] border-[#121c1b] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3">
              <span className="font-bold text-[#121c1b]">TIME: {selectedPoint.time}</span>
              <span>ZONE: <strong className="text-[#1d635d]">{selectedPoint.zone}</strong></span>
              <span>PRESSURE: <strong className={selectedPoint.status === 'critical' ? 'text-[#8b2635]' : 'text-[#121c1b]'}>{selectedPoint.pressure} mmHg</strong></span>
              <span>POSTURE: <strong>{selectedPoint.posture}</strong></span>
              {selectedPoint.note && <span className="bg-[#ffffff] px-2 py-0.5 border border-[#121c1b] text-[10px]">{selectedPoint.note}</span>}
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-[#3f4947] hover:text-[#121c1b] text-xs font-bold underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="text-[10px] sm:text-[11px] text-[#3f4947] text-center font-label-mono-sm">
            Tap any circle in the graph to inspect specific pressure recordings and turns.
          </div>
        )}
      </div>

      {/* Historical Pressure Log - Responsive Mobile Cards + Desktop Table */}
      <div className="bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#121c1b]/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1d635d] text-[19px]">table_rows</span>
            <h2 className="font-headline-sm font-bold text-xs sm:text-sm text-[#121c1b] uppercase">
              RECORDED PRESSURE &amp; REPOSITIONING LOG
            </h2>
          </div>
          <span className="font-label-mono-sm text-[10px] sm:text-xs text-[#3f4947]">
            {data8h.length} LOGS
          </span>
        </div>

        {/* Mobile View: Clinical Cards (Clean, readable, zero horizontal scrolling) */}
        <div className="md:hidden flex flex-col gap-2">
          {data8h.map((row, index) => {
            let badgeClass = 'bg-[#a3cfc9] text-[#121c1b]';
            if (row.status === 'critical') badgeClass = 'bg-[#8b2635] text-white font-bold';
            else if (row.status === 'elevated') badgeClass = 'bg-[#d97757] text-white';

            return (
              <div
                key={index}
                className="bg-[#ebf6f4] border border-[#121c1b] p-2.5 shadow-[1px_1px_0px_#121c1b] flex flex-col gap-1.5 font-label-mono-sm text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#121c1b] bg-[#ffffff] px-1.5 py-0.5 border border-[#121c1b]">
                      {row.time}
                    </span>
                    <span className="font-bold text-[#1d635d]">{row.zone}</span>
                  </div>
                  <span className={`px-2 py-0.5 border border-[#121c1b] text-[9px] uppercase font-bold ${badgeClass}`}>
                    {row.status}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#121c1b]/15 text-[11px]">
                  <span>
                    PRESSURE: <strong className={row.status === 'critical' ? 'text-[#8b2635] font-bold text-xs' : 'text-[#121c1b]'}>{row.pressure} mmHg</strong>
                  </span>
                  <span className="text-[#3f4947] truncate max-w-[150px]">{row.posture}</span>
                </div>

                {row.note && (
                  <div className="bg-[#ffffff] px-2 py-1 border border-[#121c1b]/30 text-[10px] text-[#3f4947]">
                    NOTE: {row.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop View: Full Data Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left font-label-mono-sm text-xs">
            <thead>
              <tr className="border-b-[2px] border-[#121c1b] bg-[#EDE8DC] text-[#121c1b]">
                <th className="py-2 px-3 font-bold">TIME</th>
                <th className="py-2 px-3 font-bold">CONTACT ZONE</th>
                <th className="py-2 px-3 font-bold">PRESSURE</th>
                <th className="py-2 px-3 font-bold">PATIENT POSTURE</th>
                <th className="py-2 px-3 font-bold">STATUS</th>
                <th className="py-2 px-3 font-bold">CLINICAL NOTE</th>
              </tr>
            </thead>
            <tbody>
              {data8h.map((row, index) => {
                let badgeClass = 'bg-[#a3cfc9] text-[#121c1b]';
                if (row.status === 'critical') badgeClass = 'bg-[#8b2635] text-white font-bold';
                else if (row.status === 'elevated') badgeClass = 'bg-[#d97757] text-white';

                return (
                  <tr
                    key={index}
                    className="border-b border-[#121c1b]/20 hover:bg-[#ebf6f4] transition-colors"
                  >
                    <td className="py-2 px-3 font-bold">{row.time}</td>
                    <td className="py-2 px-3 font-bold text-[#1d635d]">{row.zone}</td>
                    <td className="py-2 px-3 font-bold">
                      <span className={row.status === 'critical' ? 'text-[#8b2635] font-bold text-sm' : ''}>
                        {row.pressure} mmHg
                      </span>
                    </td>
                    <td className="py-2 px-3">{row.posture}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 border border-[#121c1b] text-[9px] uppercase ${badgeClass}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[#3f4947] text-[11px]">{row.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
