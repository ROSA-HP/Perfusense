import React, { useState, useEffect } from 'react';
import { PiezoCell } from '../types';

interface SensorHardwareViewProps {
  cells: PiezoCell[];
  showToast: (title: string, desc?: string) => void;
}

export const SensorHardwareView: React.FC<SensorHardwareViewProps> = ({
  cells,
  showToast,
}) => {
  const [selectedCell, setSelectedCell] = useState<PiezoCell>(
    cells.find((c) => c.id === 'PZ-36') || cells[35]
  );

  // Equalizer frequencies fluctuating
  const [eqHeights, setEqHeights] = useState<number[]>([
    40, 32, 48, 58, 22, 45, 64, 78, 52, 39, 28, 42, 51, 62, 33, 44, 56, 40, 35, 47, 60, 49, 25, 38,
  ]);

  // Terminal log entries
  const [logs, setLogs] = useState<string[]>([
    '[11:42:01] PZ-ARRAY: 64-channel sync verified. CRC32 valid (0x8F4A21).',
    '[11:43:15] HYSTERESIS: Offload vector calibrated against sacral node PZ-36.',
    '[11:44:00] AMBIENT: Temp shift +0.2C detected. Coefficients adapted.',
    '[11:45:22] BLE-TETHER: Retransmit count 0 in 10,000 frames. Latency 14ms.',
  ]);

  useEffect(() => {
    const eqInterval = setInterval(() => {
      setEqHeights((prev) =>
        prev.map((h) => {
          const delta = (Math.random() - 0.5) * 16;
          return Math.max(15, Math.min(92, Math.round(h + delta)));
        })
      );
    }, 450);

    return () => clearInterval(eqInterval);
  }, []);

  const handleTare = () => {
    showToast('TARE MATRIX NORMALIZED', 'All cells pegged to 0.00 kg. Zero-plane saved to MCU flash.');
    appendLog('TARE: Baseline calibrated to current ambient bed slope.');
  };

  const handleRecalibrate = () => {
    showToast('ARRAY CALIBRATION ACTIVE', 'Sending 128Hz excitation burst across 64 piezo channels...');
    appendLog('CAL: Channel sync test passed. Phase shift 0.04 deg.');
  };

  const handleSelfTest = () => {
    showToast('SELF-TEST COMPLETE: 100% PASS', 'Bus continuity, thermal normalization, ADC linearity within specs.');
    appendLog('DIAG: 64/64 cells responded. Peak hysteresis < 1.2%.');
  };

  const handleZeroNode = () => {
    showToast(`NODE ${selectedCell.id} ZEROED`, 'Local transducer DAC trimmed. Residual offset cancelled.');
    appendLog(`NODE ZERO: Transducer ${selectedCell.id} zero-point aligned.`);
  };

  const handleImpedanceSweep = () => {
    showToast(`SWEEP COMPLETED: ${selectedCell.id}`, `Complex impedance ${selectedCell.impedance} @ 10kHz.`);
    appendLog(`IMPEDANCE: Resonator ring frequency tested at 10.02 kHz for ${selectedCell.id}.`);
  };

  const appendLog = (msg: string) => {
    const d = new Date();
    const ts = d.toTimeString().split(' ')[0];
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 7)]);
  };

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* Subsystem Diagnostics Banner */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 bg-[#EDE8DC] p-5 border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#1d635d] text-white font-label-mono-sm px-2.5 py-0.5 border border-[#121c1b] uppercase">
              SUBSYSTEM DIAGNOSTICS
            </span>
            <span className="bg-[#ffffff] text-[#121c1b] font-label-mono-sm px-2.5 py-0.5 border border-[#121c1b] uppercase font-bold">
              BED 07 // ICU POD 3
            </span>
            <span className="bg-[#adefe7] text-[#00201d] font-label-mono-sm px-2.5 py-0.5 border border-[#121c1b] flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-[#004a45] animate-pulse"></span>
              BLE 5.3 LINK OK
            </span>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <h1 className="font-headline-lg text-[#121c1b] uppercase tracking-tight font-bold">
              MAT #PIEZO-64-V2
            </h1>
            <span className="font-label-mono-md text-[#3f4947] font-bold">
              [ARRAY REV 2.4B]
            </span>
          </div>
          <p className="font-body-sm text-[#3f4947] max-w-2xl">
            64-Channel Piezoelectric Continuous Pressure Transduction Grid. High-velocity surface drift telemetry and automated offload tare module.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTare}
            className="bg-[#ffffff] hover:bg-[#dfeae8] text-[#121c1b] font-label-mono-md px-4 py-2.5 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex items-center gap-2 neo-btn font-bold uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">scale</span>
            <span>TARE WEIGHT (0.00 kg)</span>
          </button>
          <button
            onClick={handleRecalibrate}
            className="bg-[#1d635d] hover:bg-[#121c1b] text-white font-label-mono-md px-4 py-2.5 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex items-center gap-2 neo-btn font-bold uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>RECALIBRATE ARRAY</span>
          </button>
          <button
            onClick={handleSelfTest}
            className="bg-[#fe9572] hover:bg-[#99462a] text-[#121c1b] hover:text-white font-label-mono-md px-4 py-2.5 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex items-center gap-2 neo-btn font-bold uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>RUN SELF-TEST</span>
          </button>
        </div>
      </div>

      {/* 6 Hardware Status Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#3f4947]">
            <span className="font-label-mono-sm uppercase text-[10px] font-bold">Sampling Rate</span>
            <span className="material-symbols-outlined text-[18px]">speed</span>
          </div>
          <div className="mt-2">
            <div className="font-label-timer text-[#1d635d] text-2xl font-bold">
              128 <span className="font-label-mono-sm text-sm text-[#121c1b]">Hz</span>
            </div>
            <div className="font-label-mono-sm text-[#3f4947] mt-1 text-[10px]">
              ±0.2Hz Clock Sync
            </div>
          </div>
        </div>

        <div className="bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#3f4947]">
            <span className="font-label-mono-sm uppercase text-[10px] font-bold">Bus Latency</span>
            <span className="material-symbols-outlined text-[18px]">timer</span>
          </div>
          <div className="mt-2">
            <div className="font-label-timer text-[#1d635d] text-2xl font-bold">
              14 <span className="font-label-mono-sm text-sm text-[#121c1b]">ms</span>
            </div>
            <div className="font-label-mono-sm text-[#3f4947] mt-1 text-[10px]">
              Jitter: &lt;1.8ms
            </div>
          </div>
        </div>

        <div className="bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#3f4947]">
            <span className="font-label-mono-sm uppercase text-[10px] font-bold">Power Stream</span>
            <span className="material-symbols-outlined text-[18px]">power</span>
          </div>
          <div className="mt-2">
            <div className="font-label-timer text-[#121c1b] text-2xl font-bold">
              92<span className="font-label-mono-sm text-sm text-[#3f4947]">%</span>
            </div>
            <div className="flex items-center gap-1 font-label-mono-sm text-[#1d635d] font-bold mt-1 text-[10px]">
              <span className="material-symbols-outlined text-[14px]">electrical_services</span> AC TETHERED
            </div>
          </div>
        </div>

        <div className="bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#3f4947]">
            <span className="font-label-mono-sm uppercase text-[10px] font-bold">SNR Average</span>
            <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
          </div>
          <div className="mt-2">
            <div className="font-label-timer text-[#1d635d] text-2xl font-bold">
              48.2 <span className="font-label-mono-sm text-sm text-[#121c1b]">dB</span>
            </div>
            <div className="font-label-mono-sm text-[#3f4947] mt-1 text-[10px]">
              Noise Flr: -72dBm
            </div>
          </div>
        </div>

        <div className="bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#3f4947]">
            <span className="font-label-mono-sm uppercase text-[10px] font-bold">Micro-Climate</span>
            <span className="material-symbols-outlined text-[18px]">thermostat</span>
          </div>
          <div className="mt-2">
            <div className="font-label-timer text-[#121c1b] text-2xl font-bold">
              22.4<span className="font-label-mono-sm text-sm text-[#121c1b]">°C</span>
            </div>
            <div className="font-label-mono-sm text-[#3f4947] mt-1 text-[10px]">
              Humidity: 46% RH
            </div>
          </div>
        </div>

        <div className="bg-[#ebf6f4] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#3f4947]">
            <span className="font-label-mono-sm uppercase text-[10px] font-bold">Bus Continuity</span>
            <span className="material-symbols-outlined text-[18px]">cable</span>
          </div>
          <div className="mt-2">
            <div className="font-label-timer text-[#1d635d] text-2xl font-bold">
              100<span className="font-label-mono-sm text-sm text-[#121c1b]">%</span>
            </div>
            <div className="font-label-mono-sm text-[#1d635d] font-bold mt-1 text-[10px]">
              RIBBON BUS SECURE
            </div>
          </div>
        </div>
      </div>

      {/* Grid Row: 64-Cell Topology Map (8 cols) & Cell Telemetry Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: 64-PIEZO CELL TOPOLOGY MAP (8 Cols) */}
        <div className="lg:col-span-8 bg-[#ffffff] p-5 sm:p-6 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#EDE8DC] p-3.5 border-[2px] border-[#121c1b]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#1d635d]"></span>
                <span className="font-headline-sm text-[#121c1b] uppercase font-bold text-sm sm:text-base">
                  64-PIEZO CELL TOPOLOGY MAP
                </span>
              </div>
              <p className="font-label-mono-sm text-[#3f4947] mt-0.5 text-[10px]">
                CLICK ANY SENSOR POINT TO INSPECT SENSOR TRANSDUCTION VOLTAGE &amp; SNR
              </p>
            </div>
            <div className="flex items-center gap-3 font-label-mono-sm text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-[#A8C5B5] border border-[#121c1b]"></span>
                NOMINAL
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-[#fe9572] border border-[#121c1b]"></span>
                DRIFT WARN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-[#8b2635] border border-[#121c1b]"></span>
                STRESS PEAK
              </span>
            </div>
          </div>

          <div className="relative w-full bg-[#ebf6f4] p-4 sm:p-6 border-[3px] border-[#121c1b] shadow-inner flex flex-col items-center">
            <div className="w-full max-w-2xl flex justify-between items-center px-2 mb-2 font-label-mono-sm text-[#3f4947] text-xs font-bold">
              <span>&lt; HEAD / CERVICAL ROW 01-08 &gt;</span>
              <span>ANTERIOR-POSTERIOR AXIS</span>
            </div>

            {/* 8x8 Clickable Matrix */}
            <div className="grid grid-cols-8 gap-1.5 sm:gap-2 w-full max-w-2xl bg-[#ffffff] p-3 sm:p-4 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b]">
              {cells.map((cell) => {
                const isSelected = selectedCell.id === cell.id;
                let bgStyle = 'bg-[#A8C5B5] text-[#121c1b] hover:bg-[#91d3cb]';
                if (cell.status === 'warn') {
                  bgStyle = 'bg-[#fe9572] text-[#121c1b] hover:bg-[#ffb59e]';
                } else if (cell.status === 'critical') {
                  bgStyle = 'bg-[#8b2635] text-white hover:bg-[#9d3442]';
                }

                return (
                  <button
                    key={cell.id}
                    onClick={() => {
                      setSelectedCell(cell);
                      appendLog(`INSPECT: Selected node ${cell.id} [${cell.zone}]`);
                    }}
                    className={`w-full aspect-square flex flex-col items-center justify-center p-1 text-center font-label-mono-sm text-[10px] tracking-tight leading-none border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] cursor-pointer transition-transform neo-btn ${bgStyle} ${
                      isSelected ? 'ring-3 ring-[#004a45] scale-105 z-10' : ''
                    }`}
                    title={`${cell.id} [${cell.zone}] - ${cell.load} mmHg`}
                  >
                    <span className="font-bold pointer-events-none">
                      {String(cell.num).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] opacity-80 pointer-events-none mt-0.5">
                      {cell.load}m
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-full max-w-2xl flex justify-between items-center px-2 mt-2 font-label-mono-sm text-[#3f4947] text-xs font-bold">
              <span>&lt; HEEL / CALCANEUS ROW 57-64 &gt;</span>
              <span>RIBBON HARNESS COORD: J1-4</span>
            </div>
          </div>

          {/* 3 Subsystem info items */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#ebf6f4] p-3.5 border-[2px] border-[#121c1b]">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#1d635d] text-[22px] shrink-0">
                troubleshoot
              </span>
              <div>
                <div className="font-label-mono-md uppercase text-[#121c1b] font-bold text-xs">
                  Auto-Zero Routine
                </div>
                <div className="font-body-sm text-[#3f4947] text-[11px] leading-snug mt-0.5">
                  Continuous hysteresis compensation running every 120s against bed tilt angles.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#1d635d] text-[22px] shrink-0">
                thermostat_auto
              </span>
              <div>
                <div className="font-label-mono-md uppercase text-[#121c1b] font-bold text-xs">
                  Thermal Normalizer
                </div>
                <div className="font-body-sm text-[#3f4947] text-[11px] leading-snug mt-0.5">
                  Piezo dielectric constant calibrated against current 22.4°C core temperature.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#1d635d] text-[22px] shrink-0">
                security_update_good
              </span>
              <div>
                <div className="font-label-mono-md uppercase text-[#121c1b] font-bold text-xs">
                  Transient Filter
                </div>
                <div className="font-body-sm text-[#3f4947] text-[11px] leading-snug mt-0.5">
                  Artifact rejection active for micro-spikes generated during caregiver adjustments.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CELL TELEMETRY INSPECTOR & FIRMWARE (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Cell Telemetry Inspector Card */}
          <div className="bg-[#EDE8DC] p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b-[2px] border-[#121c1b]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1d635d]">memory_alt</span>
                <span className="font-label-mono-md uppercase text-[#121c1b] tracking-wider font-bold">
                  CELL TELEMETRY INSPECTOR
                </span>
              </div>
              <span
                className={`font-label-mono-sm px-2 py-0.5 uppercase font-bold border border-[#121c1b] ${
                  selectedCell.status === 'critical'
                    ? 'bg-[#8b2635] text-white'
                    : selectedCell.status === 'warn'
                    ? 'bg-[#fe9572] text-[#121c1b]'
                    : 'bg-[#1d635d] text-white'
                }`}
              >
                {selectedCell.status === 'critical'
                  ? 'HIGH PEAK'
                  : selectedCell.status === 'warn'
                  ? 'DRIFT WARN'
                  : 'NOMINAL'}
              </span>
            </div>

            <div>
              <div className="font-label-mono-sm text-[#3f4947] text-xs font-bold">
                SELECTED TRANSDUCER NODE
              </div>
              <div className="font-headline-lg text-[#121c1b] uppercase mt-0.5 font-bold">
                {selectedCell.id} [{selectedCell.zone}]
              </div>
            </div>

            {/* 4 Metric Boxes */}
            <div className="grid grid-cols-2 gap-3 font-label-mono-sm">
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">VOLTAGE DROP</span>
                <span className="text-headline-sm font-bold text-[#121c1b]">
                  {selectedCell.volt}
                </span>
              </div>
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">ZERO OFFSET</span>
                <span className="text-headline-sm font-bold text-[#121c1b]">
                  {selectedCell.offset}
                </span>
              </div>
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">SNR RATIO</span>
                <span className="text-headline-sm font-bold text-[#1d635d]">
                  {selectedCell.snr}
                </span>
              </div>
              <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">IMPEDANCE</span>
                <span className="text-headline-sm font-bold text-[#121c1b]">
                  {selectedCell.impedance}
                </span>
              </div>
            </div>

            {/* Current Real-time Load Bar */}
            <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col gap-1.5">
              <div className="flex justify-between font-label-mono-sm text-xs">
                <span className="text-[#3f4947] uppercase font-bold">Current Load (Real-Time)</span>
                <span className="text-[#121c1b] font-bold">{selectedCell.load} mmHg</span>
              </div>
              <div className="w-full bg-[#ebf6f4] h-3.5 border-[2px] border-[#121c1b] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    selectedCell.status === 'critical'
                      ? 'bg-[#8b2635]'
                      : selectedCell.status === 'warn'
                      ? 'bg-[#fe9572]'
                      : 'bg-[#1d635d]'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((selectedCell.load / 55) * 100))}%` }}
                ></div>
              </div>
            </div>

            {/* Cell Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleZeroNode}
                className="flex-1 bg-[#ffffff] hover:bg-[#dfeae8] text-[#121c1b] font-label-mono-md py-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] transition-all text-center neo-btn font-bold uppercase"
              >
                ZERO NODE
              </button>
              <button
                onClick={handleImpedanceSweep}
                className="flex-1 bg-[#1d635d] hover:bg-[#121c1b] text-white font-label-mono-md py-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] transition-all text-center neo-btn font-bold uppercase"
              >
                IMPEDANCE SWEEP
              </button>
            </div>
          </div>

          {/* Array Firmware & Bus Card */}
          <div className="bg-[#ebf6f4] p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-1 border-b-[2px] border-[#121c1b]">
              <span className="font-headline-sm uppercase text-[#121c1b] font-bold">
                ARRAY FIRMWARE &amp; BUS
              </span>
              <span className="bg-[#A8C5B5] text-[#121c1b] font-label-mono-sm px-2 py-0.5 border border-[#121c1b] font-bold text-xs">
                LATEST STABLE
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-xs">
              <div>
                <div className="text-[#121c1b] font-bold">MCU FIRMWARE</div>
                <div className="text-[#3f4947]">FLIP-OS v2.14-REV-C</div>
              </div>
              <span className="text-[#1d635d] font-bold">UP TO DATE</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-xs">
              <div>
                <div className="text-[#121c1b] font-bold">RIBBON BUS HARNESS</div>
                <div className="text-[#3f4947]">Lemo 16-Pin Medical Grade</div>
              </div>
              <span className="text-[#1d635d] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span> LOCKED
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-xs">
              <div>
                <div className="text-[#121c1b] font-bold">CYCLE AGING FACTOR</div>
                <div className="text-[#3f4947]">8,412 Flexion Cycles</div>
              </div>
              <span className="text-[#121c1b] font-bold">98.2% LIFE</span>
            </div>

            <div className="bg-[#ffffff] p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[#3f4947] uppercase mb-1.5 text-[10px] font-bold">
                HARNESS CONTINUITY MATRIX
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-[#ebf6f4] border border-[#121c1b] text-center py-1 font-label-mono-sm text-[#1d635d] text-[10px] font-bold">
                  PIN 01-04 OK
                </div>
                <div className="bg-[#ebf6f4] border border-[#121c1b] text-center py-1 font-label-mono-sm text-[#1d635d] text-[10px] font-bold">
                  PIN 05-08 OK
                </div>
                <div className="bg-[#ebf6f4] border border-[#121c1b] text-center py-1 font-label-mono-sm text-[#1d635d] text-[10px] font-bold">
                  PIN 09-12 OK
                </div>
                <div className="bg-[#ebf6f4] border border-[#121c1b] text-center py-1 font-label-mono-sm text-[#1d635d] text-[10px] font-bold">
                  PIN 13-16 OK
                </div>
              </div>
            </div>
          </div>

          {/* Last full calibration card */}
          <div className="bg-[#ffffff] p-3.5 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#3f4947]">history_toggle_off</span>
              <div>
                <div className="font-label-mono-sm uppercase text-[#121c1b] font-bold text-xs">
                  LAST FULL CALIBRATION
                </div>
                <div className="font-label-mono-sm text-[#3f4947] text-[10px]">
                  TODAY - 06:14:02 AM (RN NYGÅRD)
                </div>
              </div>
            </div>
            <span className="font-label-mono-sm text-[#1d635d] font-bold text-xs">
              [AUTO-CERTIFIED]
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Dynamic Noise Floor & UART Event Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Equalizer Telemetry */}
        <div className="bg-[#ffffff] p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#1d635d] text-[22px]">equalizer</span>
            <span className="font-headline-sm uppercase text-[#121c1b] font-bold text-sm sm:text-base">
              DYNAMIC NOISE FLOOR TELEMETRY (128Hz REAL-TIME)
            </span>
          </div>
          <div className="w-full h-28 bg-[#EDE8DC] border-[2px] border-[#121c1b] flex items-end p-2 gap-1 overflow-hidden shadow-inner">
            {eqHeights.map((h, i) => {
              let barColor = 'bg-[#1d635d]/70';
              if (h > 70) barColor = 'bg-[#fe9572]';
              if (h > 85) barColor = 'bg-[#8b2635]';

              return (
                <div
                  key={i}
                  className={`w-full transition-all duration-300 ${barColor}`}
                  style={{ height: `${h}%` }}
                ></div>
              );
            })}
          </div>
          <div className="flex justify-between font-label-mono-sm text-[#3f4947] mt-2 font-bold text-[11px]">
            <span>-90 dBm (MIN DETECTABLE)</span>
            <span className="text-[#1d635d]">PEAK DRIFT: +1.4 dB</span>
            <span>-50 dBm (CEILING)</span>
          </div>
        </div>

        {/* Hardware Event Log (UART Interface) */}
        <div className="bg-[#ffffff] p-5 border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#1d635d] text-[22px]">terminal</span>
            <span className="font-headline-sm uppercase text-[#121c1b] font-bold text-sm sm:text-base">
              HARDWARE EVENT LOG (UART INTERFACE)
            </span>
          </div>
          <div className="w-full h-28 bg-[#121c1b] text-[#f1fcf9] p-3 font-label-mono-sm text-xs overflow-y-auto space-y-1.5 border-[2px] border-[#121c1b]">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-tight">
                {log.includes('PZ-ARRAY') || log.includes('BLE-TETHER') ? (
                  <span className="text-[#adefe7]">{log}</span>
                ) : log.includes('TEMP') || log.includes('HYSTERESIS') ? (
                  <span className="text-[#fe9572]">{log}</span>
                ) : (
                  <span>{log}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between font-label-mono-sm text-[#3f4947] mt-2 font-bold text-[11px]">
            <span>BUFFER: 4096 BYTES</span>
            <span className="text-[#1d635d]">STREAM ACTIVE // 115200 BAUD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
