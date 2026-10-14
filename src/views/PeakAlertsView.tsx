import React, { useState } from 'react';
import { AuditLogItem } from '../types';

interface PeakAlertsViewProps {
  auditLogs: AuditLogItem[];
  onOpenThresholds: () => void;
  showToast: (title: string, desc?: string) => void;
}

export const PeakAlertsView: React.FC<PeakAlertsViewProps> = ({
  auditLogs,
  onOpenThresholds,
  showToast,
}) => {
  const [siteFilter, setSiteFilter] = useState<'all' | 'sacral' | 'troch' | 'heels'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoneSelect, setZoneSelect] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [escalationAcknowledged, setEscalationAcknowledged] = useState<boolean>(false);

  // Filter audit logs
  const filteredLogs = auditLogs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      log.patientName.toLowerCase().includes(q) ||
      log.bedUnit.toLowerCase().includes(q) ||
      log.attendingRn.toLowerCase().includes(q) ||
      log.patientId.toLowerCase().includes(q);

    const matchesZone =
      zoneSelect === 'ALL' ||
      log.zoneCategory.toLowerCase() === zoneSelect.toLowerCase() ||
      log.zoneLocus.toLowerCase().includes(zoneSelect.toLowerCase());

    return matchesSearch && matchesZone;
  });

  const handleExecuteOffload = () => {
    showToast(
      'OFFLOAD SEQUENCE INITIATED',
      'Pneumatic cell bank deflating. Bedside team notified for Left 30° repositioning.'
    );
  };

  const handleAcknowledgeEscalation = () => {
    setEscalationAcknowledged(true);
    showToast(
      'BED 07 ESCALATION ACKNOWLEDGED',
      'Re-alert timer reset to 15m. Logged by RN K. Nygård.'
    );
  };

  const handleAcknowledgeAll = () => {
    showToast(
      'ALL ALARMS ACKNOWLEDGED',
      'All 4 active focal alerts logged to clinical record by RN K. Nygård.'
    );
  };

  const handleExportRiskReport = () => {
    showToast(
      'EXPORTING CLINICAL REPORT',
      'PDF generated for 24-Hour Ward Pressure Excursion Audit.'
    );
  };

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* TOP URGENT ESCALATION BANNER */}
      <div className="w-full bg-[#8b2635] text-[#f1fcf9] p-5 sm:p-6 border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] relative overflow-hidden">
        {/* Background Watermark */}
        <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none select-none text-[160px] font-headline-lg font-bold">
          PEAK
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start lg:items-center gap-4 min-w-0">
            <div className="w-14 h-14 bg-[#ffffff] text-[#8b2635] border-[3px] border-[#121c1b] flex items-center justify-center shrink-0 shadow-[3px_3px_0px_#121c1b]">
              <span className="material-symbols-outlined text-[34px] animate-pulse">
                crisis_alert
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="bg-[#EDE8DC] text-[#8b2635] px-2.5 py-0.5 font-label-mono-sm uppercase tracking-wider font-bold border border-[#121c1b]">
                  URGENT ESCALATION
                </span>
                <span className="bg-[#121c1b] text-[#adefe7] px-2.5 py-0.5 font-label-mono-sm border border-[#121c1b]">
                  TELEMETRY BREACH [HOTSPOT ID #EX-8902]
                </span>
                <span className="bg-[#7e1c2c] text-white px-2.5 py-0.5 font-label-mono-sm border border-[#121c1b]">
                  &gt;65 mmHg // &gt;60 MIN DWELL
                </span>
              </div>
              <h2 className="font-headline-md uppercase tracking-tight text-white leading-tight font-bold">
                Bed 07 (Pod 3): Focal Ischemia Peak Detected
              </h2>
              <p className="font-body-sm text-[#f1fcf9]/90 mt-1 max-w-3xl leading-snug">
                Sustained focal mechanical loading on Right Sacral Prominence at 74 mmHg for 68
                continuous minutes. Tissue reperfusion threshold exceeded by 142%. Immediate
                reposition offloading required.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleExecuteOffload}
              className="bg-[#ffffff] text-[#8b2635] px-4 py-2.5 font-headline-sm text-sm uppercase tracking-wide border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] hover:bg-[#EDE8DC] transition-all flex items-center gap-2 neo-btn font-bold"
            >
              <span className="material-symbols-outlined text-[20px]">rotate_90_degrees_ccw</span>
              <span>Execute Offload Turn</span>
            </button>
            <button
              onClick={handleAcknowledgeEscalation}
              className={`px-4 py-2.5 font-label-mono-md uppercase border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] transition-all flex items-center gap-2 neo-btn ${
                escalationAcknowledged
                  ? 'bg-[#A8C5B5] text-[#121c1b] font-bold'
                  : 'bg-[#121c1b] text-white hover:bg-[#3f4947]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {escalationAcknowledged ? 'check' : 'verified'}
              </span>
              <span>
                {escalationAcknowledged ? 'ESCALATION ACKNOWLEDGED' : 'Acknowledge Escalation'}
              </span>
            </button>
          </div>
        </div>

        {/* Real-time Hotspot Metrics Ticker Sub-strip */}
        <div className="mt-4 pt-3 bg-black/25 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 px-5 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 font-label-mono-sm">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <span className="text-[#ffdbd0]">
              PEAK VALUE: <strong className="text-white font-bold">74.2 mmHg</strong>
            </span>
            <span className="text-[#ffdbd0]">
              DWELL INTERVAL: <strong className="text-white font-bold">01h 08m 14s</strong>
            </span>
            <span className="text-[#ffdbd0]">
              PERFUSION RISK INDEX: <strong className="text-[#ffb2b6] font-bold">0.89 [STAGE II RISK]</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fe9572] animate-ping"></span>
            <span>LIVE SENSOR STREAM RUNNING // SUBSTRATE MAT #M90-A</span>
          </div>
        </div>
      </div>

      {/* CONTROL TOOLBAR: ACTION TRIGGERS & FILTER BADGES */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label-mono-sm text-[#3f4947] uppercase mr-1 font-bold">
            Active Filter:
          </span>
          <button
            onClick={() => setSiteFilter('all')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              siteFilter === 'all'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            All Sites (4 Active)
          </button>
          <button
            onClick={() => setSiteFilter('sacral')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              siteFilter === 'sacral'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            Sacral Hotspots (2)
          </button>
          <button
            onClick={() => setSiteFilter('troch')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              siteFilter === 'troch'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            Trochanteric (1)
          </button>
          <button
            onClick={() => setSiteFilter('heels')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              siteFilter === 'heels'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            Heels (1)
          </button>
        </div>

        {/* Action Button Group */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenThresholds}
            className="bg-[#EDE8DC] text-[#121c1b] px-3.5 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] hover:bg-[#ffffff] transition-all flex items-center gap-2 neo-btn font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Adjust Alert Thresholds</span>
          </button>
          <button
            onClick={handleExportRiskReport}
            className="bg-[#adefe7] text-[#00201d] px-3.5 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] hover:bg-[#91d3cb] transition-all flex items-center gap-2 neo-btn font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Export Clinical Risk Report</span>
          </button>
          <button
            onClick={handleAcknowledgeAll}
            className="bg-[#99462a] text-white px-3.5 py-2 font-headline-sm text-sm uppercase border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] hover:bg-[#7a2f15] transition-all flex items-center gap-2 neo-btn font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            <span>Acknowledge All</span>
          </button>
        </div>
      </div>

      {/* MIDDLE SECTION: 24-HOUR TELEMETRY TIMELINE & ANATOMICAL HEATMAP MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 24-Hour Excursion Timeline (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-[#ffffff] p-5 sm:p-6 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-[2px] border-[#121c1b] gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-label-mono-sm bg-[#1d635d] text-white px-2 py-0.5 border border-[#121c1b]">
                    TIMELINE: 24H EXCURSION
                  </span>
                  <span className="font-label-mono-sm text-[#3f4947] font-bold">
                    WINDOW: 08:00 - 08:00
                  </span>
                </div>
                <h2 className="font-headline-md uppercase text-[#121c1b] mt-1 font-bold">
                  Continuous Pressure Spikes &amp; Dwell Duration
                </h2>
              </div>
              <div className="flex items-center gap-3 font-label-mono-sm text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#8b2635] border border-[#121c1b] inline-block"></span>
                  <span className="text-[#3f4947]">Hotspot (&gt;65mmHg)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#99462a] border border-[#121c1b] inline-block"></span>
                  <span className="text-[#3f4947]">Warning (45-64)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-[#1d635d] border border-[#121c1b] inline-block"></span>
                  <span className="text-[#3f4947]">Safe (&lt;32)</span>
                </div>
              </div>
            </div>

            {/* Inline Telemetry Spike SVG Visualization */}
            <div className="w-full bg-[#EDE8DC] p-4 border-[2px] border-[#121c1b] shadow-inner my-4 relative overflow-hidden">
              <div className="flex justify-between items-center text-[#3f4947] font-label-mono-sm mb-2 font-bold">
                <span>PEAK AMPLITUDE (mmHg)</span>
                <span className="text-[#8b2635]">THRESHOLD CUTOFF: 65 mmHg</span>
              </div>
              <svg
                className="w-full h-60 text-[#121c1b] select-none"
                preserveAspectRatio="none"
                viewBox="0 0 800 240"
              >
                {/* Background Zone Bands */}
                <rect fill="#8B2635" fillOpacity="0.12" height="75" width="800" x="0" y="0"></rect>
                <rect fill="#99462a" fillOpacity="0.10" height="70" width="800" x="0" y="75"></rect>
                <rect fill="#004a45" fillOpacity="0.08" height="95" width="800" x="0" y="145"></rect>

                {/* Horizontal Guide Gridlines */}
                <line stroke="#8B2635" strokeDasharray="4,4" strokeWidth="1.5" x1="0" x2="800" y1="35" y2="35"></line>
                <text fill="#8B2635" fontFamily="Space Mono" fontSize="11" fontWeight="700" x="10" y="30">
                  75 mmHg [CRITICAL ISCHEMIA BOUND]
                </text>
                <line stroke="#99462a" strokeDasharray="2,2" strokeWidth="1.5" x1="0" x2="800" y1="75" y2="75"></line>
                <text fill="#99462a" fontFamily="Space Mono" fontSize="11" fontWeight="700" x="10" y="70">
                  65 mmHg [PEAK WARNING THRESHOLD]
                </text>
                <line stroke="#004a45" strokeDasharray="2,2" strokeWidth="1.5" x1="0" x2="800" y1="145" y2="145"></line>
                <text fill="#004a45" fontFamily="Space Mono" fontSize="11" fontWeight="700" x="10" y="140">
                  32 mmHg [CAPILLARY CLOSING PRESSURE]
                </text>

                {/* Vertical Time Markers */}
                <line stroke="#131d1c" strokeOpacity="0.1" strokeWidth="1" x1="100" x2="100" y1="0" y2="240"></line>
                <line stroke="#131d1c" strokeOpacity="0.1" strokeWidth="1" x1="260" x2="260" y1="0" y2="240"></line>
                <line stroke="#131d1c" strokeOpacity="0.1" strokeWidth="1" x1="440" x2="440" y1="0" y2="240"></line>
                <line stroke="#131d1c" strokeOpacity="0.1" strokeWidth="1" x1="620" x2="620" y1="0" y2="240"></line>
                <line stroke="#131d1c" strokeOpacity="0.1" strokeWidth="1" x1="750" x2="750" y1="0" y2="240"></line>

                {/* Historical Curve Fill */}
                <path
                  d="M 0,180 Q 50,175 100,165 T 200,185 T 260,110 T 320,135 T 440,190 T 520,140 T 580,90 T 640,40 T 700,32 T 760,38 L 800,45 L 800,240 L 0,240 Z"
                  fill="#99462a"
                  fillOpacity="0.18"
                ></path>
                {/* Main Pressure Line */}
                <path
                  d="M 0,180 Q 50,175 100,165 T 200,185 T 260,110 T 320,135 T 440,190 T 520,140 T 580,90 T 640,40 T 700,32 T 760,38 L 800,45"
                  fill="none"
                  stroke="#131d1c"
                  strokeLinecap="square"
                  strokeWidth="3"
                ></path>

                {/* Excursion Hotspot Area */}
                <path
                  d="M 610,65 L 640,40 T 700,32 T 760,38 L 800,45 L 800,75 L 610,75 Z"
                  fill="#8B2635"
                  fillOpacity="0.45"
                ></path>

                {/* Highlight Points */}
                <circle cx="260" cy="110" fill="#99462a" r="5" stroke="#131d1c" strokeWidth="2"></circle>
                <circle cx="580" cy="90" fill="#99462a" r="5" stroke="#131d1c" strokeWidth="2"></circle>
                <circle cx="700" cy="32" fill="#8B2635" r="7" stroke="#F4F6F0" strokeWidth="3"></circle>
                <text fill="#8B2635" fontFamily="Space Mono" fontSize="12" fontWeight="700" x="660" y="22">
                  74.2 mmHg [MAX]
                </text>
              </svg>

              {/* Dwell Time Progression Bars */}
              <div className="mt-3 pt-2 border-t border-[#121c1b]/20 flex flex-col gap-1.5">
                <div className="flex justify-between text-[#3f4947] font-label-mono-sm text-[11px] font-bold">
                  <span>ACTIVE ZONE DWELL RATIOS</span>
                  <span>LOG: SHIFT A + B</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-7">
                  <div className="bg-[#1d635d] text-white flex items-center justify-between px-2 font-label-mono-sm border border-[#121c1b] text-[10px]">
                    <span>08:00 - 14:00</span>
                    <span className="font-bold">SAFE</span>
                  </div>
                  <div className="bg-[#fe9572] text-[#121c1b] flex items-center justify-between px-2 font-label-mono-sm border border-[#121c1b] text-[10px]">
                    <span>14:00 - 20:00</span>
                    <span className="font-bold">R-TROCH 48m</span>
                  </div>
                  <div className="bg-[#1d635d] text-white flex items-center justify-between px-2 font-label-mono-sm border border-[#121c1b] text-[10px]">
                    <span>20:00 - 02:00</span>
                    <span className="font-bold">TURNING ON SCHED</span>
                  </div>
                  <div className="bg-[#8b2635] text-white flex items-center justify-between px-2 font-label-mono-sm border border-[#121c1b] font-bold text-[10px]">
                    <span>02:00 - NOW</span>
                    <span>68m BREACH</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparative Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col justify-between">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">Mean Exposure</span>
                <span className="font-display-hero text-2xl font-bold text-[#121c1b] mt-1">36.4</span>
                <span className="font-label-mono-sm text-[#1d635d] text-xs font-bold">mmHg (Ward Avg: 31)</span>
              </div>
              <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col justify-between">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">Longest Dwell</span>
                <span className="font-display-hero text-2xl font-bold text-[#8b2635] mt-1">68m</span>
                <span className="font-label-mono-sm text-[#8b2635] text-xs font-bold">+8m Over Q1H Rule</span>
              </div>
              <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col justify-between">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">Offload Frequency</span>
                <span className="font-display-hero text-2xl font-bold text-[#121c1b] mt-1">11</span>
                <span className="font-label-mono-sm text-[#3f4947] text-xs">Turns / 24 Hours</span>
              </div>
              <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col justify-between">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">Sensor Stability</span>
                <span className="font-display-hero text-2xl font-bold text-[#1d635d] mt-1">99.4%</span>
                <span className="font-label-mono-sm text-[#1d635d] bg-[#ffffff] border border-[#121c1b] px-1 text-center font-bold text-xs">
                  CALIBRATED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Anatomical Risk Matrix (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#ffffff] p-5 sm:p-6 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-1 border-b-[2px] border-[#121c1b]">
                <span className="font-label-mono-sm bg-[#121c1b] text-white px-2 py-0.5 border border-[#121c1b]">
                  TOPOLOGY MATRIX
                </span>
                <span className="font-label-mono-sm text-[#3f4947] font-bold">4 PRIMARY LOCI</span>
              </div>
              <h2 className="font-headline-md uppercase text-[#121c1b] mt-2 font-bold">
                Anatomical Ischemia Matrix
              </h2>
              <p className="font-body-sm text-[#3f4947] text-xs mt-1">
                Regional gradient density map based on active piezoresistive sensor clusters.
              </p>
            </div>

            {/* 4 Anatomical Focus Cards */}
            <div className="grid grid-cols-2 gap-3 my-4">
              {/* Card 1: Sacrum (CRITICAL) */}
              <div className="bg-[#8b2635] text-white p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-sm uppercase font-bold tracking-wider text-[11px]">
                    [01] SACRUM
                  </span>
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></span>
                </div>
                <div className="my-2 flex justify-center items-center py-2 bg-black/20 border border-black/30">
                  <svg className="w-14 h-10 text-white" viewBox="0 0 80 60">
                    <ellipse cx="40" cy="30" fill="none" rx="28" ry="18" stroke="currentColor" strokeWidth="2"></ellipse>
                    <path d="M 30,22 Q 40,38 50,22" fill="none" stroke="currentColor" strokeWidth="3"></path>
                    <circle cx="40" cy="30" fill="#F4F6F0" r="8"></circle>
                    <circle cx="40" cy="30" fill="none" r="14" stroke="#F4F6F0" strokeDasharray="2,2" strokeWidth="2"></circle>
                  </svg>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-label-mono-sm opacity-80 text-[10px]">PEAK:</span>
                    <span className="font-label-mono-lg font-bold text-sm">74 mmHg</span>
                  </div>
                  <div className="bg-[#ffffff] text-[#8b2635] font-label-mono-sm px-1 font-bold text-center mt-1 text-[10px]">
                    EXCEEDS BOUND (&gt;60m)
                  </div>
                </div>
              </div>

              {/* Card 2: Trochanters (ELEVATED) */}
              <div className="bg-[#EDE8DC] text-[#121c1b] p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-sm uppercase font-bold tracking-wider text-[11px]">
                    [02] TROCH
                  </span>
                  <span className="w-2.5 h-2.5 bg-[#99462a]"></span>
                </div>
                <div className="my-2 flex justify-center items-center py-2 bg-[#ffffff] border border-[#121c1b]">
                  <svg className="w-14 h-10 text-[#121c1b]" viewBox="0 0 80 60">
                    <rect fill="none" height="30" rx="4" stroke="currentColor" strokeWidth="2" width="40" x="20" y="15"></rect>
                    <circle cx="28" cy="30" fill="#99462a" r="6"></circle>
                    <circle cx="52" cy="30" fill="#004a45" r="4"></circle>
                  </svg>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-label-mono-sm text-[#3f4947] text-[10px]">R-LATERAL:</span>
                    <span className="font-label-mono-lg font-bold text-[#99462a] text-sm">52 mmHg</span>
                  </div>
                  <div className="bg-[#fe9572] text-[#121c1b] font-label-mono-sm px-1 text-center mt-1 font-bold text-[10px]">
                    ELEVATED (32m DWELL)
                  </div>
                </div>
              </div>

              {/* Card 3: Heels (WATCH) */}
              <div className="bg-[#EDE8DC] text-[#121c1b] p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-sm uppercase font-bold tracking-wider text-[11px]">
                    [03] HEELS
                  </span>
                  <span className="w-2.5 h-2.5 bg-[#1d635d]"></span>
                </div>
                <div className="my-2 flex justify-center items-center py-2 bg-[#ffffff] border border-[#121c1b]">
                  <svg className="w-14 h-10 text-[#121c1b]" viewBox="0 0 80 60">
                    <ellipse cx="30" cy="30" fill="none" rx="10" ry="16" stroke="currentColor" strokeWidth="2"></ellipse>
                    <ellipse cx="50" cy="30" fill="none" rx="10" ry="16" stroke="currentColor" strokeWidth="2"></ellipse>
                    <circle cx="30" cy="36" fill="#004a45" r="4"></circle>
                    <circle cx="50" cy="36" fill="#004a45" r="4"></circle>
                  </svg>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-label-mono-sm text-[#3f4947] text-[10px]">BILATERAL:</span>
                    <span className="font-label-mono-lg font-bold text-[#1d635d] text-sm">28 mmHg</span>
                  </div>
                  <div className="bg-[#dfeae8] text-[#121c1b] font-label-mono-sm px-1 text-center mt-1 text-[10px]">
                    BOOT OFFLOAD OK
                  </div>
                </div>
              </div>

              {/* Card 4: Occiput (NORMAL) */}
              <div className="bg-[#EDE8DC] text-[#121c1b] p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-sm uppercase font-bold tracking-wider text-[11px]">
                    [04] OCCIPUT
                  </span>
                  <span className="w-2.5 h-2.5 bg-[#1d635d]"></span>
                </div>
                <div className="my-2 flex justify-center items-center py-2 bg-[#ffffff] border border-[#121c1b]">
                  <svg className="w-14 h-10 text-[#121c1b]" viewBox="0 0 80 60">
                    <circle cx="40" cy="28" fill="none" r="18" stroke="currentColor" strokeWidth="2"></circle>
                    <circle cx="40" cy="32" fill="#004a45" r="5"></circle>
                  </svg>
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-label-mono-sm text-[#3f4947] text-[10px]">POST-CRANIAL:</span>
                    <span className="font-label-mono-lg font-bold text-[#1d635d] text-sm">19 mmHg</span>
                  </div>
                  <div className="bg-[#dfeae8] text-[#121c1b] font-label-mono-sm px-1 text-center mt-1 text-[10px]">
                    PERFUSED &gt; 90%
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Offload Directive Prompt */}
            <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#8b2635] text-[24px] shrink-0 font-bold">
                priority_high
              </span>
              <p className="font-body-sm text-[#121c1b] text-xs">
                Recommended Turn Position: <strong>30° Left Lateral Tilt</strong> with sacral foam wedge isolation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: INCIDENT AUDIT & ISCHEMIA HISTORY LOG TABLE */}
      <div className="w-full bg-[#ebf6f4] p-5 sm:p-6 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-mono-sm bg-[#121c1b] text-white px-2 py-0.5 border border-[#121c1b]">
                LEGAL COMPLIANCE LOG
              </span>
              <span className="font-label-mono-sm text-[#3f4947]">ISO 13485 / NPUAP STANDARDS</span>
            </div>
            <h3 className="font-headline-md uppercase text-[#121c1b] mt-1 font-bold">
              Pressure Excursion Incident Audit Log
            </h3>
          </div>

          {/* Search & Column Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, bed, or RN..."
                type="text"
                className="bg-[#ffffff] text-[#121c1b] placeholder:text-[#3f4947] font-label-mono-sm px-3 py-1.5 pr-8 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] focus:outline-none w-56 sm:w-64"
              />
              <span className="material-symbols-outlined absolute right-2 top-2 text-[#3f4947] text-[18px]">
                search
              </span>
            </div>

            <select
              value={zoneSelect}
              onChange={(e) => setZoneSelect(e.target.value)}
              className="bg-[#ffffff] text-[#121c1b] font-label-mono-sm px-3 py-1.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Zones</option>
              <option value="Sacrum">Sacrum</option>
              <option value="Trochanter">Trochanter</option>
              <option value="Heels">Heels</option>
              <option value="Occiput">Occiput</option>
            </select>

            <button
              onClick={() => {
                setSearchQuery('');
                setZoneSelect('ALL');
                showToast('FILTERS RESET', 'Audit log displaying all records.');
              }}
              className="bg-[#ffffff] hover:bg-[#dfeae8] text-[#121c1b] px-3 py-1.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase neo-btn font-bold"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="w-full overflow-x-auto border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] bg-[#ffffff]">
          <table className="w-full text-left font-body-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#121c1b] text-[#ffffff] font-label-mono-sm uppercase tracking-wider text-xs">
                <th className="p-3 border-r border-[#3f4947]">Timestamp</th>
                <th className="p-3 border-r border-[#3f4947]">Bed / Unit</th>
                <th className="p-3 border-r border-[#3f4947]">Patient ID</th>
                <th className="p-3 border-r border-[#3f4947]">Zone Locus</th>
                <th className="p-3 border-r border-[#3f4947] text-right">Peak (mmHg)</th>
                <th className="p-3 border-r border-[#3f4947] text-right">Dwell Time</th>
                <th className="p-3 border-r border-[#3f4947]">Action Taken</th>
                <th className="p-3 border-r border-[#3f4947]">Attending RN</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c1b]/20 font-label-mono-sm text-xs">
              {filteredLogs.map((log) => {
                const isActive = log.status === 'ACTIVE';

                return (
                  <tr
                    key={log.id}
                    className={`transition-colors ${
                      isActive ? 'bg-[#8b2635]/10 hover:bg-[#8b2635]/20' : 'hover:bg-[#ebf6f4]'
                    }`}
                  >
                    <td className={`p-3 font-bold ${isActive ? 'text-[#8b2635]' : 'text-[#121c1b]'}`}>
                      {log.timestamp}
                    </td>
                    <td className="p-3 font-bold">{log.bedUnit}</td>
                    <td className="p-3 text-[#3f4947]">{log.patientId} ({log.patientName})</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 border border-[#121c1b] font-bold text-[10px] ${
                          log.zoneCategory === 'Sacrum'
                            ? 'bg-[#8b2635] text-white'
                            : log.zoneCategory === 'Trochanter'
                            ? 'bg-[#99462a] text-white'
                            : 'bg-[#ebf6f4] text-[#121c1b]'
                        }`}
                      >
                        {log.zoneLocus}
                      </span>
                    </td>
                    <td
                      className={`p-3 text-right font-bold ${
                        log.peakMmHg > 65 ? 'text-[#8b2635]' : 'text-[#99462a]'
                      }`}
                    >
                      {log.peakMmHg} mmHg
                    </td>
                    <td className={`p-3 text-right font-bold ${isActive ? 'text-[#8b2635]' : ''}`}>
                      {log.dwellMin} MIN
                    </td>
                    <td className="p-3 font-body-sm text-[#121c1b] max-w-xs">{log.actionTaken}</td>
                    <td className="p-3 font-bold">{log.attendingRn}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 border border-[#121c1b] font-bold uppercase text-[10px] ${
                          isActive
                            ? 'bg-[#8b2635] text-white animate-pulse'
                            : 'bg-[#1d635d] text-white'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[#3f4947] font-label-mono-sm gap-3">
          <div className="flex items-center gap-2">
            <span>SHOWING {filteredLogs.length} OF 42 AUDITED EXCURSIONS</span>
            <span className="bg-[#ffffff] border border-[#121c1b] px-2 py-0.5 font-bold text-[#121c1b]">
              PAGE {currentPage} / 7
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-[#ffffff] px-3 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] text-[#121c1b] neo-btn font-bold disabled:opacity-40"
            >
              PREV
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(7, p + 1))}
              disabled={currentPage === 7}
              className="bg-[#ffffff] px-3 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] text-[#121c1b] neo-btn font-bold disabled:opacity-40"
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
