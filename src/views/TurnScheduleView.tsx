import React, { useState, useEffect } from 'react';

interface TurnScheduleViewProps {
  showToast: (title: string, desc?: string) => void;
}

export const TurnScheduleView: React.FC<TurnScheduleViewProps> = ({ showToast }) => {
  const [cadence, setCadence] = useState<'60m' | '90m' | '120m'>('120m');
  const [skinEnforce, setSkinEnforce] = useState<boolean>(true);
  const [bed07Completed, setBed07Completed] = useState<boolean>(false);
  const [bed07Checks, setBed07Checks] = useState<boolean[]>([false, false, false, false]);
  const [bed03Completed, setBed03Completed] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<string>('14:00');
  const [clockTime, setClockTime] = useState<string>('13:46:12');

  // Realistic ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClockTime(
        now.toTimeString().split(' ')[0]
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCompleteBed07 = () => {
    setBed07Completed(true);
    setBed07Checks([true, true, true, true]);
    showToast('BED 07 TURN TRANSMITTED', 'Logged to Epic Inpatient flowsheet with RN K. Nygård signature.');
  };

  const handleDeferBed07 = () => {
    showToast('BED 07 TURN DEFERRED +10M', 'Reason code: Bedside Clinical Assessment. Flowsheet updated.');
  };

  const handleCompleteBed03 = () => {
    setBed03Completed(true);
    showToast('BED 03 EARLY COMPLETION LOGGED', 'Turn to 30° Right Lateral verified by RN J. Baek.');
  };

  const handleBroadcastAll = () => {
    showToast('BROADCAST DISPATCHED', 'Ward-wide rotation notification broadcast to Pod 3 pagers & Vocera.');
  };

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* TOP CLINICAL CONTROL BANNER */}
      <div className="w-full bg-[#EDE8DC] p-4 sm:p-5 border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1d635d] text-[#f1fcf9] flex items-center justify-center border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] shrink-0">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#1d635d] text-[#ffffff] font-label-mono-sm px-2 py-0.5 tracking-wider uppercase border border-[#121c1b]">
                SHIFT ACTIVE
              </span>
              <span className="font-label-mono-sm text-[#99462a] font-bold tracking-widest uppercase">
                DAY ROTATION 07:00 – 19:00
              </span>
            </div>
            <h1 className="font-headline-lg text-[#121c1b] tracking-tight mt-1">
              TURN SCHEDULE &amp; REPOSITIONING PROTOCOLS
            </h1>
          </div>
        </div>

        {/* Right Quick Telemetry Chips */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-[#ffffff] p-2 sm:px-3 sm:py-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#99462a] text-[20px]">verified</span>
            <div className="leading-tight">
              <div className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">STANDARD</div>
              <div className="font-label-mono-md text-[#121c1b]">NPUAP/EPUAP 2024</div>
            </div>
          </div>

          <div className="bg-[#ffffff] p-2 sm:px-3 sm:py-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1d635d] text-[20px]">sync</span>
            <div className="leading-tight">
              <div className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">EHR PIPE</div>
              <div className="font-label-mono-md text-[#1d635d] font-bold">EPIC CLOUD OK</div>
            </div>
          </div>

          <button
            onClick={handleBroadcastAll}
            className="bg-[#fe9572] hover:bg-[#99462a] text-[#121c1b] hover:text-white px-4 py-2.5 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] transition-all font-label-mono-md uppercase flex items-center gap-2 neo-btn"
          >
            <span className="material-symbols-outlined text-[18px]">cached</span>
            <span>BROADCAST ALL DUE</span>
          </button>
        </div>
      </div>

      {/* MAIN DUAL-PANE COCKPIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: INTERACTIVE DAILY ROTATION TIMELINE (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Shift Progress Card */}
          <div className="bg-[#ebf6f4] p-4 sm:p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#1d635d] rounded-full animate-pulse"></span>
                <span className="font-label-mono-md text-[#121c1b] tracking-wider uppercase font-bold">
                  SHIFT CYCLE CHRONO
                </span>
              </div>
              <span className="font-label-timer text-[#1d635d] font-bold">
                {clockTime}
              </span>
            </div>

            <div className="w-full bg-[#dae5e3] h-3.5 border-[2px] border-[#121c1b] relative overflow-hidden">
              <div className="bg-[#1d635d] h-full w-[56%] transition-all"></div>
            </div>

            <div className="flex justify-between font-label-mono-sm text-[#3f4947] uppercase font-bold text-[11px]">
              <span>07:00 START</span>
              <span className="text-[#1d635d]">56% COMPLETED</span>
              <span>19:00 HANDOFF</span>
            </div>

            {/* Posture Legend Pills */}
            <div className="pt-1 grid grid-cols-2 gap-2 font-label-mono-sm">
              <div className="flex items-center gap-2 bg-[#ffffff] p-1.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="w-3.5 h-3.5 bg-[#1d635d] border border-[#121c1b]"></span>
                <span className="text-[11px]">R-LATERAL 30°</span>
              </div>
              <div className="flex items-center gap-2 bg-[#ffffff] p-1.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="w-3.5 h-3.5 bg-[#fe9572] border border-[#121c1b]"></span>
                <span className="text-[11px]">L-LATERAL 30°</span>
              </div>
              <div className="flex items-center gap-2 bg-[#ffffff] p-1.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="w-3.5 h-3.5 bg-[#A8C5B5] border border-[#121c1b]"></span>
                <span className="text-[11px]">SUPINE OFFLOAD</span>
              </div>
              <div className="flex items-center gap-2 bg-[#ffffff] p-1.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="w-3.5 h-3.5 bg-[#EDE8DC] border border-[#121c1b]"></span>
                <span className="text-[11px]">FOWLER 45°</span>
              </div>
            </div>
          </div>

          {/* Timeline Rail */}
          <div className="bg-[#ebf6f4] p-4 sm:p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b-[2px] border-[#121c1b]">
              <span className="font-headline-sm text-[#121c1b] uppercase">ROSTER CADENCE</span>
              <span className="font-label-mono-sm bg-[#ffffff] border-[2px] border-[#121c1b] px-2 py-0.5 text-[#121c1b] font-bold shadow-[2px_2px_0px_#121c1b]">
                Q2H SYNC
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Slot 08:00 (Completed) */}
              <div
                onClick={() => setActiveSlot('08:00')}
                className={`cursor-pointer bg-[#ffffff] transition-all p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center justify-between hover:bg-[#dfeae8] ${
                  activeSlot === '08:00' ? 'ring-2 ring-[#1d635d]' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-label-mono-lg text-[#3f4947] font-bold">08:00</span>
                  <div className="w-2.5 h-8 bg-[#A8C5B5] border border-[#121c1b]"></div>
                  <div>
                    <div className="font-label-mono-sm text-[#121c1b] font-bold uppercase">
                      SUPINE 0° + HEEL SUSPENSION
                    </div>
                    <div className="font-body-sm text-[#3f4947] text-xs">
                      All 6 Beds Executed · Signed RN NYGÅRD
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#1d635d] text-[22px]">
                  check_circle
                </span>
              </div>

              {/* Slot 10:00 (Completed) */}
              <div
                onClick={() => setActiveSlot('10:00')}
                className={`cursor-pointer bg-[#ffffff] transition-all p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center justify-between hover:bg-[#dfeae8] ${
                  activeSlot === '10:00' ? 'ring-2 ring-[#1d635d]' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-label-mono-lg text-[#3f4947] font-bold">10:00</span>
                  <div className="w-2.5 h-8 bg-[#1d635d] border border-[#121c1b]"></div>
                  <div>
                    <div className="font-label-mono-sm text-[#121c1b] font-bold uppercase">
                      R-LATERAL 30° TILT
                    </div>
                    <div className="font-body-sm text-[#3f4947] text-xs">
                      Trochanter offloaded · Signed RN BAEK
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#1d635d] text-[22px]">
                  check_circle
                </span>
              </div>

              {/* Slot 12:00 (Completed) */}
              <div
                onClick={() => setActiveSlot('12:00')}
                className={`cursor-pointer bg-[#ffffff] transition-all p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center justify-between hover:bg-[#dfeae8] ${
                  activeSlot === '12:00' ? 'ring-2 ring-[#1d635d]' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-label-mono-lg text-[#3f4947] font-bold">12:00</span>
                  <div className="w-2.5 h-8 bg-[#EDE8DC] border border-[#121c1b]"></div>
                  <div>
                    <div className="font-label-mono-sm text-[#121c1b] font-bold uppercase">
                      SEMI-FOWLER 30° / MEAL REST
                    </div>
                    <div className="font-body-sm text-[#3f4947] text-xs">
                      Erythema Check OK · Signed RN NYGÅRD
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#1d635d] text-[22px]">
                  check_circle
                </span>
              </div>

              {/* Slot 14:00 (NOW DUE / ACTIVE FOCUS) */}
              <div
                onClick={() => setActiveSlot('14:00')}
                className="bg-[#1d635d] text-[#ffffff] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex items-center justify-between -translate-y-0.5 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className="font-label-mono-lg font-bold text-[#adefe7]">14:00</span>
                    <span className="font-label-mono-sm bg-[#8b2635] text-white px-1 uppercase tracking-widest mt-0.5 font-bold text-[10px]">
                      DUE NOW
                    </span>
                  </div>
                  <div className="w-2.5 h-10 bg-[#fe9572] border border-[#121c1b]"></div>
                  <div>
                    <div className="font-label-mono-sm font-bold tracking-wide uppercase text-white">
                      L-LATERAL 30° WEDGE ROTATION
                    </div>
                    <div className="font-body-sm text-[#adefe7] text-xs">
                      {bed07Completed ? 'Bed 07 Completed' : '3 Beds Pending Turn • Timer: -00:14m'}
                    </div>
                  </div>
                </div>
                <button className="bg-[#ffffff] text-[#121c1b] px-2.5 py-1 font-label-mono-sm uppercase border-[2px] border-[#121c1b] hover:bg-[#EDE8DC] shadow-[2px_2px_0px_#121c1b] font-bold">
                  EXPAND
                </button>
              </div>

              {/* Slot 16:00 (Upcoming) */}
              <div
                onClick={() => setActiveSlot('16:00')}
                className="opacity-80 hover:opacity-100 bg-[#ffffff] transition-all p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-label-mono-lg text-[#121c1b] font-bold">16:00</span>
                  <div className="w-2.5 h-8 bg-[#A8C5B5] border border-[#121c1b]"></div>
                  <div>
                    <div className="font-label-mono-sm text-[#121c1b] font-bold uppercase">
                      SUPINE 15° DORSAL ELEVATION
                    </div>
                    <div className="font-body-sm text-[#3f4947] text-xs">
                      Alternating Air Mattress cycle 4 queued
                    </div>
                  </div>
                </div>
                <span className="font-label-mono-sm text-[#3f4947] uppercase font-bold text-xs">
                  IN 2H 14M
                </span>
              </div>

              {/* Slot 18:00 (Upcoming) */}
              <div
                onClick={() => setActiveSlot('18:00')}
                className="opacity-80 hover:opacity-100 bg-[#ffffff] transition-all p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-label-mono-lg text-[#121c1b] font-bold">18:00</span>
                  <div className="w-2.5 h-8 bg-[#1d635d] border border-[#121c1b]"></div>
                  <div>
                    <div className="font-label-mono-sm text-[#121c1b] font-bold uppercase">
                      R-LATERAL 30° PRE-HANDOFF TURN
                    </div>
                    <div className="font-body-sm text-[#3f4947] text-xs">
                      Braden High-risk bed priority
                    </div>
                  </div>
                </div>
                <span className="font-label-mono-sm text-[#3f4947] uppercase font-bold text-xs">
                  IN 4H 14M
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Shift Buddy Coupling */}
          <div className="bg-[#EDE8DC] p-4 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm uppercase text-[#3f4947] font-bold">
                ASSIGNED SHIFT BUDDY COUPLING
              </span>
              <span className="bg-[#1d635d] text-[#ffffff] font-label-mono-sm px-2 py-0.5 border border-[#121c1b] shadow-[1px_1px_0px_#121c1b] font-bold">
                2-PERSON LIFTS
              </span>
            </div>
            <div className="flex items-center justify-between bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#1d635d] text-[#ffffff] font-label-mono-md flex items-center justify-center font-bold border border-[#121c1b]">
                  KN
                </div>
                <div>
                  <div className="font-headline-sm leading-none text-[#121c1b]">
                    RN Karin Nygård
                  </div>
                  <div className="font-label-mono-sm text-[#3f4947] text-[11px] mt-1">
                    ICU WARD LEAD (POD 3)
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#1d635d] text-[22px]">
                link
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#99462a] text-[#ffffff] font-label-mono-md flex items-center justify-center font-bold border border-[#121c1b]">
                  JB
                </div>
                <div>
                  <div className="font-headline-sm leading-none text-[#121c1b]">
                    RN Jin Baek
                  </div>
                  <div className="font-label-mono-sm text-[#3f4947] text-[11px] mt-1">
                    PRESSURE SPEC.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT/MAIN PANEL: PATIENT CARDS & PROTOCOL ENGINE (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* PROTOCOL CONFIG & EHR CONTROLLER CARD */}
          <div className="bg-[#e5f0ee] p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b-[2px] border-[#121c1b]">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#1d635d] text-[26px]">
                  tune
                </span>
                <div>
                  <h2 className="font-headline-sm text-[#121c1b] uppercase font-bold">
                    WARD PROTOCOL &amp; ACTUATION CONTROLLER
                  </h2>
                  <div className="font-body-sm text-[#3f4947]">
                    Dynamic cadence override and pneumatic cell alternating rules
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[#A8C5B5] text-[#121c1b] font-label-mono-sm px-2 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold">
                  [NPUAP/EPUAP COMPLIANT]
                </span>
                <span className="bg-[#ffffff] text-[#121c1b] font-label-mono-sm px-2 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold">
                  [VERIFIED EHR]
                </span>
              </div>
            </div>

            {/* Setting Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Turn Interval Preset */}
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col gap-2">
                <label className="font-label-mono-sm uppercase text-[#3f4947] font-bold flex justify-between">
                  <span>TURN CADENCE</span>
                  <span className="text-[#99462a] font-bold">{cadence.toUpperCase()}</span>
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['60m', '90m', '120m'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setCadence(opt);
                        showToast(`CADENCE UPDATED: ${opt}`, 'Ward timer schedules refreshed.');
                      }}
                      className={`py-1.5 font-label-mono-sm border border-[#121c1b] transition-all text-center ${
                        cadence === opt
                          ? 'bg-[#1d635d] text-[#ffffff] font-bold shadow-[2px_2px_0px_#121c1b]'
                          : 'bg-[#ebf6f4] text-[#121c1b] hover:bg-[#dfeae8]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="font-label-mono-sm text-[#3f4947] text-[11px] leading-tight">
                  Rule: 90m auto-applies when Braden Score &lt; 12.
                </div>
              </div>

              {/* Skin Assessment Checkbox Toggle */}
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
                <div>
                  <span className="font-label-mono-sm uppercase text-[#3f4947] font-bold block mb-1">
                    SKIN INSPECTION ENFORCEMENT
                  </span>
                  <p className="font-body-sm text-[#121c1b] text-xs leading-snug">
                    Mandatory sacral/heel photography every 2nd rotation
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    checked={skinEnforce}
                    onChange={(e) => setSkinEnforce(e.target.checked)}
                    className="w-5 h-5 accent-[#1d635d] cursor-pointer"
                    id="skinEnforceToggle"
                    type="checkbox"
                  />
                  <label
                    className="font-label-mono-sm text-[#121c1b] uppercase cursor-pointer font-bold"
                    htmlFor="skinEnforceToggle"
                  >
                    ACTIVE ENFORCE
                  </label>
                </div>
              </div>

              {/* Pneumatic Cell Mode */}
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
                <div>
                  <span className="font-label-mono-sm uppercase text-[#3f4947] font-bold block mb-1">
                    AIR MAT RELIEF CYCLE
                  </span>
                  <p className="font-body-sm text-[#121c1b] text-xs leading-snug">
                    Dynamic 1-in-3 alternating cell relief pressure
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-label-mono-md text-[#1d635d] font-bold">
                    CYCLE: 10 MIN
                  </span>
                  <span className="material-symbols-outlined text-[#1d635d] text-[20px]">
                    air
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PATIENT 1: BED 07 (URGENT / CURRENT CRITICAL FOCUS) */}
          <div className="bg-[#ffffff] border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] p-5 sm:p-6 flex flex-col gap-4 relative overflow-hidden">
            {/* Status Ribbon */}
            <div
              className={`w-full p-2.5 sm:p-3 border-[2px] border-[#121c1b] flex flex-wrap items-center justify-between text-[#121c1b] font-label-mono-sm ${
                bed07Completed ? 'bg-[#ebf6f4]' : 'bg-[#fe9572]'
              }`}
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold uppercase tracking-wider bg-[#121c1b] text-white px-2 py-0.5">
                  PRIORITY 1
                </span>
                <span className="font-bold">BED 07 • ICU-POD-3</span>
                <span>PATIENT: VALENTINA S. (BRADEN SCORE: 10 / SEVERE RISK)</span>
              </div>
              <div className="flex items-center gap-1 font-bold">
                {bed07Completed ? (
                  <span className="text-[#1d635d] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>TURN CONFIRMED 14:02</span>
                  </span>
                ) : (
                  <span className="text-[#8b2635] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">alarm</span>
                    <span>OVERDUE BY +00:14m</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Col 1: Anatomical Bolster Placement SVG Graphic (5 cols) */}
              <div className="md:col-span-5 bg-[#EDE8DC] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-sm uppercase text-[#3f4947] font-bold">
                    TARGET ANGLE &amp; WEDGES
                  </span>
                  <span className="bg-[#1d635d] text-white font-label-mono-sm px-2 py-0.5 font-bold border border-[#121c1b]">
                    LEFT 30°
                  </span>
                </div>

                {/* Anatomical Bolster Wedge Diagram SVG */}
                <div className="w-full bg-[#ffffff] p-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col items-center justify-center">
                  <svg
                    className="w-full h-36 text-[#121c1b]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 240 140"
                  >
                    {/* Bed Frame Base */}
                    <rect
                      fill="#dfeae8"
                      height="12"
                      stroke="#131d1c"
                      strokeWidth="2"
                      width="200"
                      x="20"
                      y="110"
                    ></rect>
                    {/* Pneumatic Mattress Cell waves */}
                    <path
                      d="M 25 106 Q 35 98 45 106 Q 55 98 65 106 Q 75 98 85 106 Q 95 98 105 106 Q 115 98 125 106 Q 135 98 145 106 Q 155 98 165 106 Q 175 98 185 106 Q 195 98 205 106 Q 215 98 225 106"
                      fill="none"
                      stroke="#004a45"
                      strokeWidth="2"
                    ></path>
                    {/* Ergonomic Wedge Bolster */}
                    <polygon
                      fill="#fe9572"
                      points="65,106 115,106 115,58"
                      stroke="#131d1c"
                      strokeWidth="2"
                    ></polygon>
                    <text
                      fill="#131d1c"
                      fontFamily="Space Mono"
                      fontSize="8"
                      fontWeight="bold"
                      x="78"
                      y="98"
                    >
                      30° WEDGE
                    </text>
                    {/* Patient Torso Transverse Cross-section Tilted 30 Deg Left */}
                    <g transform="rotate(-30 130 80)">
                      <ellipse
                        cx="130"
                        cy="80"
                        fill="#F4F6F0"
                        rx="42"
                        ry="22"
                        stroke="#131d1c"
                        strokeWidth="2.5"
                      ></ellipse>
                      <circle cx="130" cy="80" fill="#004a45" r="4"></circle>
                      <text
                        fill="#131d1c"
                        fontFamily="Space Mono"
                        fontSize="8"
                        x="105"
                        y="83"
                      >
                        SACRUM OFFLOAD
                      </text>
                    </g>
                    {/* Secondary Knee Spacer */}
                    <polygon
                      fill="#A8C5B5"
                      points="170,106 205,106 205,82"
                      stroke="#131d1c"
                      strokeWidth="2"
                    ></polygon>
                    <text
                      fill="#131d1c"
                      fontFamily="Space Mono"
                      fontSize="7"
                      x="174"
                      y="102"
                    >
                      KNEE SPACER
                    </text>
                    {/* Angle Arc Indicator */}
                    <path
                      d="M 115 106 A 28 28 0 0 1 138 90"
                      fill="none"
                      stroke="#8b2635"
                      strokeDasharray="3,2"
                      strokeWidth="2"
                    ></path>
                    <text
                      fill="#8b2635"
                      fontFamily="Space Mono"
                      fontSize="10"
                      fontWeight="bold"
                      x="142"
                      y="94"
                    >
                      30°
                    </text>
                  </svg>
                  <div className="w-full flex justify-between font-label-mono-sm text-[#3f4947] pt-1 text-[10px]">
                    <span>WEDGE 1: DORSAL THORACIC</span>
                    <span>WEDGE 2: INTER-CONDYLAR</span>
                  </div>
                </div>

                {/* Air Cell Relief Status */}
                <div className="bg-[#ffffff] p-2 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] flex items-center justify-between text-[#121c1b] font-label-mono-sm">
                  <span>PNEUMATIC CELL BANK #2:</span>
                  <span className="text-[#1d635d] font-bold">DEFLATED (OFFLOAD ZONE 4)</span>
                </div>
              </div>

              {/* Col 2: Action Dashboard & Nurse Sign-off (7 cols) */}
              <div className="md:col-span-7 flex flex-col justify-between h-full gap-4">
                <div className="flex flex-col gap-3">
                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                      <span className="font-label-mono-sm text-[#3f4947] block text-[10px]">
                        ASSIGNED RN
                      </span>
                      <span className="font-headline-sm text-[#121c1b] truncate block mt-0.5">
                        K. Nygård
                      </span>
                    </div>
                    <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                      <span className="font-label-mono-sm text-[#3f4947] block text-[10px]">
                        PEAK SACRAL
                      </span>
                      <span className="font-headline-sm text-[#8b2635] block mt-0.5 font-bold">
                        44 mmHg ⚠️
                      </span>
                    </div>
                    <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                      <span className="font-label-mono-sm text-[#3f4947] block text-[10px]">
                        SKIN STAGE
                      </span>
                      <span className="font-headline-sm text-[#121c1b] block mt-0.5">
                        STAGE 1 BLUSH
                      </span>
                    </div>
                  </div>

                  {/* Step Checklist for Bedside Turn */}
                  <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col gap-2">
                    <span className="font-label-mono-sm text-[#3f4947] font-bold uppercase">
                      EXECUTION AUDIT CHECKLIST:
                    </span>
                    {[
                      'Reposition patient to Left 30° lateral tilt using slide sheet',
                      'Slide high-density foam wedge under right sacro-iliac crest',
                      'Verify heels floated clear of mattress surface',
                      'Conduct dermal erythema check on sacral bony prominence',
                    ].map((step, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-2 cursor-pointer select-none hover:bg-white/60 p-1"
                      >
                        <input
                          checked={bed07Checks[idx]}
                          onChange={(e) => {
                            const updated = [...bed07Checks];
                            updated[idx] = e.target.checked;
                            setBed07Checks(updated);
                          }}
                          className="w-4 h-4 accent-[#1d635d] cursor-pointer"
                          type="checkbox"
                        />
                        <span className="font-body-sm text-[#121c1b]">{step}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Digital Sign-off Confirmation Bar */}
                <div className="bg-[#dfeae8] p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#1d635d] text-[24px]">
                      fingerprint
                    </span>
                    <div>
                      <div className="font-label-mono-sm text-[#121c1b] font-bold uppercase">
                        DIGITAL SIGN-OFF READY
                      </div>
                      <div className="font-label-mono-sm text-[#3f4947] text-[10px]">
                        RN Credentials auto-bind to Epic Flowsheet
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeferBed07}
                      className="bg-[#ffffff] hover:bg-[#ebf6f4] text-[#121c1b] px-3 py-1.5 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn"
                    >
                      DEFER 10M
                    </button>
                    <button
                      onClick={handleCompleteBed07}
                      className={`px-4 py-1.5 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex items-center gap-1.5 neo-btn ${
                        bed07Completed
                          ? 'bg-[#A8C5B5] text-[#121c1b] font-bold'
                          : 'bg-[#1d635d] hover:bg-[#121c1b] text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {bed07Completed ? 'verified' : 'send'}
                      </span>
                      <span>{bed07Completed ? 'LOGGED TO EHR' : 'LOG TURN & TRANSMIT'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Trail Accordion Footer */}
            <div className="bg-[#ebf6f4] p-2 border-[2px] border-[#121c1b] flex flex-wrap items-center justify-between font-label-mono-sm text-[#3f4947] text-[11px]">
              <span>LAST LOGGED: 12:00 (SUPINE 15°) • SIGNED: RN K. NYGÅRD [ID #78441]</span>
              <span className="text-[#1d635d] font-bold">
                EPIC ENCOUNTER #889-1029 • SYNCED 12:02:14
              </span>
            </div>
          </div>

          {/* PATIENT 2: BED 03 (STANDARD ON-SCHEDULE CYCLE) */}
          <div className="bg-[#ffffff] border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] p-5 sm:p-6 flex flex-col gap-4 relative">
            {/* Status Ribbon */}
            <div className="w-full bg-[#dfeae8] p-2.5 sm:p-3 border-[2px] border-[#121c1b] flex flex-wrap items-center justify-between text-[#121c1b] font-label-mono-sm">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold uppercase tracking-wider bg-[#1d635d] text-white px-2 py-0.5">
                  ON SCHEDULE
                </span>
                <span className="font-bold">BED 03 • ICU-POD-1</span>
                <span>PATIENT: ARJUN M. (BRADEN SCORE: 15 / MODERATE RISK)</span>
              </div>
              <div className="flex items-center gap-1 font-bold text-[#1d635d]">
                <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                <span>DUE IN 24 MIN (14:15)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Graphic Diagram Right Lateral 30° */}
              <div className="md:col-span-5 bg-[#EDE8DC] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-sm uppercase text-[#3f4947] font-bold">
                    NEXT TARGET ORIENTATION
                  </span>
                  <span className="bg-[#99462a] text-white font-label-mono-sm px-2 py-0.5 font-bold border border-[#121c1b]">
                    RIGHT 30° TILT
                  </span>
                </div>

                <div className="w-full bg-[#ffffff] p-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col items-center justify-center">
                  <svg
                    className="w-full h-36 text-[#121c1b]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 240 140"
                  >
                    <rect
                      fill="#dfeae8"
                      height="12"
                      stroke="#131d1c"
                      strokeWidth="2"
                      width="200"
                      x="20"
                      y="110"
                    ></rect>
                    <path
                      d="M 25 106 Q 35 98 45 106 Q 55 98 65 106 Q 75 98 85 106 Q 95 98 105 106 Q 115 98 125 106 Q 135 98 145 106 Q 155 98 165 106 Q 175 98 185 106 Q 195 98 205 106 Q 215 98 225 106"
                      fill="none"
                      stroke="#1d635d"
                      strokeWidth="2"
                    ></path>
                    {/* Right Wedge */}
                    <polygon
                      fill="#fe9572"
                      points="175,106 125,106 125,58"
                      stroke="#131d1c"
                      strokeWidth="2"
                    ></polygon>
                    <text
                      fill="#131d1c"
                      fontFamily="Space Mono"
                      fontSize="8"
                      fontWeight="bold"
                      x="132"
                      y="98"
                    >
                      30° WEDGE
                    </text>
                    {/* Patient Tilted Right */}
                    <g transform="rotate(30 110 80)">
                      <ellipse
                        cx="110"
                        cy="80"
                        fill="#F4F6F0"
                        rx="42"
                        ry="22"
                        stroke="#131d1c"
                        strokeWidth="2.5"
                      ></ellipse>
                      <circle cx="110" cy="80" fill="#1d635d" r="4"></circle>
                      <text
                        fill="#131d1c"
                        fontFamily="Space Mono"
                        fontSize="8"
                        x="80"
                        y="83"
                      >
                        L-TROCHANTER FREE
                      </text>
                    </g>
                    {/* Heel suspension ring */}
                    <circle
                      cx="45"
                      cy="100"
                      fill="#A8C5B5"
                      r="9"
                      stroke="#131d1c"
                      strokeWidth="1.5"
                    ></circle>
                    <text fill="#131d1c" fontFamily="Space Mono" fontSize="7" x="35" y="103">
                      BOOT
                    </text>
                  </svg>
                  <div className="w-full flex justify-between font-label-mono-sm text-[#3f4947] pt-1 text-[10px]">
                    <span>WEDGE: LEFT FLANK SUPPORT</span>
                    <span>HEELS: PRAFO BOOTS IN SITU</span>
                  </div>
                </div>

                <div className="bg-[#ffffff] p-2 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] flex items-center justify-between text-[#121c1b] font-label-mono-sm">
                  <span>MAT CYCLE PRE-VENT:</span>
                  <span className="text-[#121c1b] font-bold">STANDBY INFLATION</span>
                </div>
              </div>

              {/* Col 2: Actions */}
              <div className="md:col-span-7 flex flex-col justify-between h-full gap-4">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                      <span className="font-label-mono-sm text-[#3f4947] block text-[10px]">
                        ASSIGNED RN
                      </span>
                      <span className="font-headline-sm text-[#121c1b] truncate block mt-0.5">
                        J. Baek
                      </span>
                    </div>
                    <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                      <span className="font-label-mono-sm text-[#3f4947] block text-[10px]">
                        PEAK PRESSURE
                      </span>
                      <span className="font-headline-sm text-[#1d635d] block mt-0.5 font-bold">
                        26 mmHg (NOMINAL)
                      </span>
                    </div>
                    <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                      <span className="font-label-mono-sm text-[#3f4947] block text-[10px]">
                        SKIN STAGE
                      </span>
                      <span className="font-headline-sm text-[#121c1b] block mt-0.5">
                        INTACT NO LESION
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#ebf6f4] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col gap-2">
                    <span className="font-label-mono-sm text-[#3f4947] font-bold uppercase">
                      PENDING TASKS (14:15 TURN):
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#1d635d]">
                        radio_button_unchecked
                      </span>
                      <span className="font-body-sm text-[#121c1b]">
                        Turn to 30° Right Lateral Decubitus position
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#1d635d]">
                        radio_button_unchecked
                      </span>
                      <span className="font-body-sm text-[#121c1b]">
                        Inspect bilateral heels and re-secure PRAFO orthoses
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#1d635d]">
                        radio_button_unchecked
                      </span>
                      <span className="font-body-sm text-[#121c1b]">
                        Confirm telemetry pressure drops below 32 mmHg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Button Row */}
                <div className="bg-[#dfeae8] p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-wrap items-center justify-between gap-3">
                  <span className="font-label-mono-sm text-[#3f4947] uppercase">
                    EHR PRE-VALIDATED • NO WARNINGS
                  </span>
                  <button
                    onClick={handleCompleteBed03}
                    className={`px-4 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] transition-all neo-btn ${
                      bed03Completed
                        ? 'bg-[#A8C5B5] text-[#121c1b] font-bold'
                        : 'bg-[#ffffff] hover:bg-[#1d635d] hover:text-white text-[#121c1b]'
                    }`}
                  >
                    {bed03Completed ? 'RECORDED' : 'RECORD EARLY COMPLETION'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#ebf6f4] p-2 border-[2px] border-[#121c1b] flex flex-wrap items-center justify-between font-label-mono-sm text-[#3f4947] text-[11px]">
              <span>LAST LOGGED: 12:15 (LEFT 30°) • SIGNED: RN J. BAEK [ID #81093]</span>
              <span className="text-[#1d635d] font-bold">
                EHR CONFIRMED: EPIC INPATIENT #492-9912
              </span>
            </div>
          </div>

          {/* COMPLIANCE & AUDIT SHIFT BENCHMARK SECTION */}
          <div className="bg-[#EDE8DC] p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b-[2px] border-[#121c1b]">
              <div>
                <span className="font-label-mono-sm uppercase text-[#99462a] font-bold tracking-wider">
                  REGULATORY PROTOCOL METRICS
                </span>
                <h3 className="font-headline-sm text-[#121c1b] uppercase font-bold">
                  WARD SHIFT COMPLIANCE &amp; POSITION DURATION AUDIT
                </h3>
              </div>
              <span className="bg-[#ffffff] text-[#121c1b] font-label-mono-md px-3 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold">
                OVERALL COMPLIANCE: 94.2%
              </span>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">
                  TOTAL TURNS SCHEDULED
                </span>
                <span className="font-headline-lg text-[#121c1b] mt-1">28</span>
                <span className="font-label-mono-sm text-[#1d635d] font-bold text-xs">
                  24 COMPLETED • 4 DUE
                </span>
              </div>
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">
                  MEAN TURN DELAY
                </span>
                <span className="font-headline-lg text-[#1d635d] mt-1">
                  4.2<span className="text-sm font-normal text-[#121c1b]">min</span>
                </span>
                <span className="font-label-mono-sm text-[#1d635d] font-bold text-xs">
                  WELL WITHIN ±15M TOLERANCE
                </span>
              </div>
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">
                  SACRAL PEAK EXCURSIONS
                </span>
                <span className="font-headline-lg text-[#99462a] mt-1">2</span>
                <span className="font-label-mono-sm text-[#99462a] font-bold text-xs">
                  BOTH OFFLOADED &lt; 8 MIN
                </span>
              </div>
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col">
                <span className="font-label-mono-sm text-[#3f4947] uppercase text-[10px]">
                  EHR SYNC INTEGRITY
                </span>
                <span className="font-headline-lg text-[#1d635d] mt-1">100%</span>
                <span className="font-label-mono-sm text-[#1d635d] font-bold text-xs">
                  ALL DIGITAL SIGNATURES SECURE
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
