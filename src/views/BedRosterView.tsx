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
}) => {
  const [filter, setFilter] = useState<'all' | 'due' | 'high_risk'>('all');

  const filteredBeds = beds.filter((bed) => {
    if (filter === 'due') return bed.status === 'due_now' || bed.status === 'overdue';
    if (filter === 'high_risk') return bed.bradenScore <= 12;
    return true;
  });

  const getStatusBadge = (status: PatientBed['status']) => {
    switch (status) {
      case 'due_now':
      case 'overdue':
        return 'bg-[#8b2635] text-white font-bold animate-pulse';
      case 'pre_alert':
      case 'elevated':
        return 'bg-[#d97757] text-white font-bold';
      case 'ambulating':
        return 'bg-[#EDE8DC] text-[#121c1b]';
      case 'optimal':
      case 'stable':
      default:
        return 'bg-[#adefe7] text-[#00201d] font-bold';
    }
  };

  return (
    <div className="flex flex-col gap-4 select-none w-full max-w-[1400px] mx-auto">
      {/* Clean Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#EDE8DC] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
            <h1 className="font-headline-lg text-[#121c1b] uppercase tracking-tight font-bold text-base sm:text-lg">
              BED ROSTER
            </h1>
          </div>
          <p className="font-body-sm text-[#3f4947] text-xs mt-0.5">
            ICU POD 3 // Patient turn schedules and contact pressure overview.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 font-label-mono-sm text-xs font-bold uppercase transition-all cursor-pointer border-[2px] border-[#121c1b] ${
              filter === 'all'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#ebf6f4]'
            }`}
          >
            ALL BEDS ({beds.length})
          </button>
          <button
            onClick={() => setFilter('due')}
            className={`px-3 py-1 font-label-mono-sm text-xs font-bold uppercase transition-all cursor-pointer border-[2px] border-[#121c1b] ${
              filter === 'due'
                ? 'bg-[#8b2635] text-white shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#ffffff] text-[#8b2635] hover:bg-[#ffdadb]'
            }`}
          >
            DUE NOW ({beds.filter((b) => b.status === 'due_now' || b.status === 'overdue').length})
          </button>
          <button
            onClick={() => setFilter('high_risk')}
            className={`px-3 py-1 font-label-mono-sm text-xs font-bold uppercase transition-all cursor-pointer border-[2px] border-[#121c1b] ${
              filter === 'high_risk'
                ? 'bg-[#1d635d] text-white shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#ebf6f4]'
            }`}
          >
            HIGH RISK ({beds.filter((b) => b.bradenScore <= 12).length})
          </button>
        </div>
      </div>

      {/* Simplified 8-Bed Clinical Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredBeds.map((bed) => {
          const isUrgent = bed.status === 'due_now' || bed.status === 'overdue';
          const isElevated = bed.status === 'elevated' || bed.status === 'pre_alert';

          return (
            <div
              key={bed.id}
              className={`bg-[#ffffff] border-[3px] ${
                isUrgent ? 'border-[#8b2635]' : 'border-[#121c1b]'
              } shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between p-3.5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5`}
            >
              <div>
                {/* Bed Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#121c1b]/20">
                  <span className="font-headline-sm font-bold text-sm uppercase text-[#121c1b]">
                    {bed.bedNumber}
                  </span>
                  <span className={`px-2 py-0.5 font-label-mono-sm text-[10px] uppercase border border-[#121c1b] ${getStatusBadge(bed.status)}`}>
                    {bed.statusLabel}
                  </span>
                </div>

                {/* Patient Information */}
                <div className="mt-2.5">
                  <h2 className="font-headline-md text-sm text-[#121c1b] font-bold uppercase truncate">
                    {bed.patientName}
                  </h2>
                  <div className="flex items-center justify-between text-[11px] font-label-mono-sm text-[#3f4947] mt-1">
                    <span>Braden: <strong className={bed.bradenScore <= 12 ? 'text-[#8b2635]' : 'text-[#121c1b]'}>{bed.bradenScore} ({bed.bradenRisk})</strong></span>
                    <span>RN: {bed.assignedRn.split(' ')[1] || 'Assigned'}</span>
                  </div>
                </div>

                {/* Posture & Pressure Stats */}
                <div className="bg-[#ebf6f4] p-2.5 border border-[#121c1b] my-3 space-y-1 text-xs font-label-mono-sm">
                  <div className="flex justify-between">
                    <span className="text-[#3f4947]">POSTURE:</span>
                    <span className="font-bold text-[#121c1b] truncate max-w-[130px]">{bed.posture}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#3f4947]">PEAK LOAD:</span>
                    <span className={`font-bold ${isUrgent ? 'text-[#8b2635]' : isElevated ? 'text-[#d97757]' : 'text-[#1d635d]'}`}>
                      {bed.peakPressure} mmHg
                    </span>
                  </div>
                </div>

                {/* Countdown to Next Turn */}
                <div className="mb-3">
                  <div className="flex justify-between items-baseline text-[11px] font-label-mono-sm mb-1">
                    <span className="text-[#3f4947] font-bold">NEXT TURN:</span>
                    <span className={`font-bold ${isUrgent ? 'text-[#8b2635]' : 'text-[#121c1b]'}`}>
                      {bed.countdown}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#dfeae8] border border-[#121c1b] overflow-hidden">
                    <div
                      className={`h-full ${
                        isUrgent
                          ? 'bg-[#8b2635] w-full'
                          : isElevated
                          ? 'bg-[#d97757] w-3/4'
                          : 'bg-[#1d635d] w-1/2'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#121c1b]/20">
                <button
                  onClick={() => onLogTurnForBed(bed)}
                  className={`flex-1 py-1.5 px-2 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] font-headline-sm text-xs uppercase font-bold text-center transition-all neo-btn cursor-pointer ${
                    isUrgent
                      ? 'bg-[#8b2635] text-white hover:bg-[#6c1c28]'
                      : 'bg-[#1d635d] text-white hover:bg-[#121c1b]'
                  }`}
                >
                  LOG TURN
                </button>
                <button
                  onClick={() => onInspectBed(bed)}
                  className="px-2 py-1.5 bg-[#ffffff] hover:bg-[#ebf6f4] border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] text-xs font-bold text-[#121c1b] neo-btn cursor-pointer"
                  title="View patient details"
                >
                  DETAILS
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
