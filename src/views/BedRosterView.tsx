import React, { useState } from 'react';
import { PatientBed } from '../types';

interface BedRosterViewProps {
  beds: PatientBed[];
  onLogTurnForBed: (bed: PatientBed) => void;
  onInspectBed: (bed: PatientBed) => void;
  showToast: (title: string, desc?: string) => void;
}

export const BedRosterView: React.FC<BedRosterViewProps> = ({
  beds,
  onLogTurnForBed,
  onInspectBed,
  showToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'high_risk' | 'due' | 'lateral'>('all');
  const [displayDensity, setDisplayDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const filteredBeds = beds.filter((bed) => {
    if (filter === 'high_risk') return bed.bradenScore <= 12;
    if (filter === 'due') return bed.status === 'due_now' || bed.status === 'overdue';
    if (filter === 'lateral') return bed.posture.toLowerCase().includes('lateral');
    return true;
  });

  const getStatusColor = (status: PatientBed['status']) => {
    switch (status) {
      case 'due_now':
      case 'overdue':
        return 'bg-[#8b2635] text-white';
      case 'pre_alert':
      case 'elevated':
        return 'bg-[#fe9572] text-[#121c1b]';
      case 'ambulating':
        return 'bg-[#EDE8DC] text-[#121c1b]';
      case 'optimal':
      case 'stable':
      default:
        return 'bg-[#ebf6f4] text-[#121c1b]';
    }
  };

  const getMiniCellBg = (val: number) => {
    if (val === 0) return 'bg-[#A8C5B5]';
    if (val === 1) return 'bg-[#fe9572]';
    if (val === 3) return 'bg-[#8b2635]';
    return 'bg-[#dae5e3]';
  };

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* Unit Command Ribbon & Summary Matrix */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 bg-[#004a45] border-2 border-[#121c1b] inline-block"></span>
            <span className="font-label-mono-sm uppercase text-[#3f4947] tracking-widest font-bold">
              WARD UNIT OVERVIEW // WING 4 NORTH
            </span>
          </div>
          <h1 className="font-headline-lg text-[#121c1b] tracking-tight uppercase">
            Bed Roster &amp; Pressure Telemetry
          </h1>
        </div>

        {/* Live Telemetry KPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full xl:w-auto">
          <div className="bg-[#ebf6f4] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex flex-col justify-between">
            <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">Active Mats</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline-md text-[#121c1b]">12</span>
              <span className="font-label-mono-sm text-[#1d635d] font-bold">/ 14 BEDS</span>
            </div>
          </div>

          <div className="bg-[#ffdadb] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex flex-col justify-between">
            <span className="font-label-mono-sm text-[#842131] uppercase font-bold text-[10px]">
              Turns Due
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline-md text-[#8b2635]">02</span>
              <span className="font-label-mono-sm text-[#8b2635] font-bold">IMMINENT</span>
            </div>
          </div>

          <div className="bg-[#ebf6f4] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex flex-col justify-between">
            <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">Compliance</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline-md text-[#1d635d]">98.4%</span>
              <span className="font-label-mono-sm text-[#3f4947] font-bold">Q2H</span>
            </div>
          </div>

          <div className="bg-[#adefe7] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex flex-col justify-between">
            <span className="font-label-mono-sm text-[#00201d] uppercase font-bold text-[10px]">
              HAPI Gr.2+
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline-md text-[#00201d]">0</span>
              <span className="font-label-mono-sm text-[#00201d] font-bold">ZERO TOL.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Rapid Sort Toolbar */}
      <div className="bg-[#ebf6f4] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label-mono-sm text-[#121c1b] uppercase mr-1 font-bold">
            FILTER:
          </span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              filter === 'all'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            ALL (8)
          </button>
          <button
            onClick={() => setFilter('high_risk')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              filter === 'high_risk'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            HIGH RISK (3)
          </button>
          <button
            onClick={() => setFilter('due')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              filter === 'due'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            DUE / OVERDUE (2)
          </button>
          <button
            onClick={() => setFilter('lateral')}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm uppercase transition-all neo-btn ${
              filter === 'lateral'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b] font-bold'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            LATERAL TILT (5)
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#ffffff] px-2.5 py-1 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b]">
            <span className="font-label-mono-sm text-[#3f4947] uppercase font-bold text-[10px]">
              LEGEND:
            </span>
            <span className="flex items-center gap-1 font-label-mono-sm text-xs">
              <span className="w-2.5 h-2.5 bg-[#A8C5B5] border border-[#121c1b] inline-block"></span>
              &lt;24mmHg
            </span>
            <span className="flex items-center gap-1 font-label-mono-sm text-xs">
              <span className="w-2.5 h-2.5 bg-[#fe9572] border border-[#121c1b] inline-block"></span>
              25-32
            </span>
            <span className="flex items-center gap-1 font-label-mono-sm text-xs">
              <span className="w-2.5 h-2.5 bg-[#8b2635] border border-[#121c1b] inline-block"></span>
              &gt;32 (PEAK)
            </span>
          </div>

          <button
            onClick={() => {
              setDisplayDensity(displayDensity === 'comfortable' ? 'compact' : 'comfortable');
              showToast(
                `DENSITY: ${displayDensity === 'comfortable' ? 'COMPACT' : 'COMFORTABLE'}`,
                'Bed card dimensions updated.'
              );
            }}
            className="bg-[#EDE8DC] text-[#121c1b] px-3 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase flex items-center gap-1.5 hover:bg-[#dfeae8] neo-btn font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>DISPLAY DENSITY</span>
          </button>
        </div>
      </div>

      {/* 8-Bed Clinical Grid */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6 ${
          displayDensity === 'compact' ? 'gap-4' : 'gap-6'
        }`}
      >
        {filteredBeds.map((bed) => {
          const isUrgent = bed.status === 'due_now' || bed.status === 'overdue';
          const isElevated = bed.status === 'elevated' || bed.status === 'pre_alert';

          return (
            <div
              key={bed.id}
              className={`bg-[#ffffff] border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col justify-between relative overflow-hidden transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 ${
                isUrgent ? 'border-[#8b2635]' : ''
              }`}
            >
              {/* Card Header Status Banner */}
              <div
                className={`px-4 py-2 border-b-[3px] border-[#121c1b] flex justify-between items-center ${getStatusColor(
                  bed.status
                )}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm font-bold uppercase tracking-tight">
                    {bed.bedNumber}
                  </span>
                  <span className="bg-[#ffffff] text-[#121c1b] px-1.5 py-0.2 font-label-mono-sm font-bold uppercase border border-[#121c1b] text-[10px]">
                    {bed.statusLabel}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[20px]">
                  {bed.status === 'ambulating'
                    ? 'transfer_within_a_station'
                    : isUrgent
                    ? 'priority_high'
                    : 'check_circle'}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  {/* Patient Bio Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="font-headline-md text-[#121c1b] uppercase tracking-tight leading-tight">
                        {bed.patientName}
                      </h2>
                      <span className="font-label-mono-sm text-[#3f4947] block text-xs mt-0.5">
                        ID: {bed.patientId}
                      </span>
                    </div>
                    <div
                      className={`px-2 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] text-center ${
                        bed.bradenScore <= 12
                          ? 'bg-[#8b2635] text-white'
                          : 'bg-[#ebf6f4] text-[#121c1b]'
                      }`}
                    >
                      <span className="font-label-mono-sm block leading-none text-[9px] uppercase">
                        BRADEN
                      </span>
                      <span className="font-headline-sm font-bold leading-none">
                        {bed.bradenScore}
                      </span>
                    </div>
                  </div>

                  {/* Mat & Metric Section */}
                  <div className="grid grid-cols-2 gap-3 my-3 bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b]">
                    {/* 8x8 Mini Sensor Matrix */}
                    <div className="flex flex-col">
                      <span className="font-label-mono-sm text-[#3f4947] uppercase mb-1 text-[10px]">
                        SENSOR 8X8
                      </span>
                      <div
                        className={`grid grid-cols-8 gap-0.5 bg-[#121c1b] p-1 border border-[#121c1b] w-fit aspect-square ${
                          bed.status === 'ambulating' ? 'opacity-30' : ''
                        }`}
                      >
                        {bed.sensorMini.map((row, rI) =>
                          row.map((val, cI) => (
                            <span
                              key={`${rI}-${cI}`}
                              className={`w-2.5 h-2.5 inline-block ${getMiniCellBg(val)}`}
                            ></span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Position & Focal Load */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <span className="font-label-mono-sm text-[#3f4947] uppercase block text-[10px]">
                          POSTURE
                        </span>
                        <span className="bg-[#ffffff] px-1.5 py-1 border border-[#121c1b] font-label-mono-sm font-bold block text-[#121c1b] mt-1 text-xs truncate">
                          {bed.posture}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="font-label-mono-sm text-[#3f4947] uppercase block text-[10px]">
                          {bed.pressureLabel}
                        </span>
                        <span
                          className={`font-label-mono-lg font-bold ${
                            isUrgent
                              ? 'text-[#8b2635]'
                              : isElevated
                              ? 'text-[#99462a]'
                              : 'text-[#1d635d]'
                          }`}
                        >
                          {bed.peakPressure} mmHg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Countdown & Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <span
                        className={`font-label-mono-sm font-bold uppercase text-xs ${
                          isUrgent ? 'text-[#8b2635]' : 'text-[#121c1b]'
                        }`}
                      >
                        {bed.status === 'ambulating'
                          ? 'OFFLOAD DURATION'
                          : isUrgent
                          ? 'INTERVAL ELAPSED'
                          : 'NEXT TURN DUE'}
                      </span>
                      <span
                        className={`font-label-timer font-bold text-lg ${
                          isUrgent ? 'text-[#8b2635]' : 'text-[#121c1b]'
                        }`}
                      >
                        {bed.countdown}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#dfeae8] border-[2px] border-[#121c1b] overflow-hidden">
                      <div
                        className={`h-full ${
                          isUrgent
                            ? 'bg-[#8b2635] w-full'
                            : isElevated
                            ? 'bg-[#fe9572] w-3/4'
                            : 'bg-[#1d635d] w-1/2'
                        }`}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions Row */}
                <div className="flex items-center gap-2 pt-2 border-t-[2px] border-[#121c1b]">
                  <button
                    onClick={() => onLogTurnForBed(bed)}
                    className="flex-1 bg-[#1d635d] hover:bg-[#121c1b] text-white py-2 px-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-headline-sm text-xs uppercase font-bold tracking-wider text-center neo-btn"
                  >
                    {bed.status === 'ambulating' ? 'RETURN TO BED' : 'LOG TURN'}
                  </button>
                  <button
                    onClick={() => onInspectBed(bed)}
                    className="p-2 bg-[#ffffff] hover:bg-[#ebf6f4] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn"
                    title="Quick Detail View"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                  <button
                    onClick={() =>
                      showToast(
                        `ALARM ACKNOWLEDGED: ${bed.bedNumber}`,
                        'Notification muted for 15 minutes.'
                      )
                    }
                    className={`p-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn ${
                      isUrgent
                        ? 'bg-[#ffdadb] text-[#8b2635] hover:bg-[#ffb2b6]'
                        : 'bg-[#ffffff] text-[#3f4947] hover:bg-[#ebf6f4]'
                    }`}
                    title="Acknowledge or mute alarm"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isUrgent ? 'notifications_off' : 'notifications'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
