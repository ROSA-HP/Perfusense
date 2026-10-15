# Perfusense System Simplification & Layout Restructure

Streamlines the clinical bedside monitoring experience by removing redundant chrome, consolidating zone dwell analytics into a dedicated view, isolating the hardware topology map, and eliminating non-essential debug visual elements.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core product and design decisions have been established and confirmed based on your input:

- **Confirmed Decision 1 (Top Black Marquee)**: The black ticker bar (`PERFUSENSE // BED 07 // LIVE ...`) above the navbar will be completely removed. The top navbar will sit directly at `top: 0`, and page padding will be adjusted accordingly.
- **Confirmed Decision 2 (Zone Timers Relocation)**: The Zone Timers card will be removed from the Live Heatmap page and placed inside the dedicated **Zones** tab (`PeakAlertsView` / `ZonesView`), completely replacing the complex ischemia matrix and threshold cards.
- **Confirmed Decision 3 (Live Page Layout)**: With Zone Timers moved, the Live Heatmap expands to full width with the pressure distribution and cell details cleanly laid out, followed directly by the 8-Hour Body Posture Chronology and quick shift note verification bar.
- **Confirmed Decision 4 (Settings / Hardware Isolation)**: On the Hardware view, all extraneous telemetry cards (BLE latency, microclimate, noise floor equalizer, and raw UART terminal) will be removed, keeping exclusively the interactive **64-Piezo Cell Topology Map**.
- **Confirmed Decision 5 (Navbar & Sidebar Navigation Alignment)**: The `SETTINGS` pill button will be removed from the top navigation bar (which will now cleanly host `LIVE`, `HISTORY`, and `ZONES`). Access to the Sensor Mat Hardware topology will remain available exclusively through the hover flyout sidebar.
- **Confirmed Decision 6 (Visual De-cluttering)**: Remove technical sample badges (`[SAMPLE DATA]`, `[HEATING UP]`, tilted stickers, debug code tags) to produce a calm, distraction-free clinical environment.

---

## 1. Overview & Core Concept

Perfusense is a bedside clinical system for continuous pressure injury prevention. By decluttering the interface, clinical nurses and caregivers can rapidly assess patient repositioning needs without extraneous technical telemetry or visual noise.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TOP NAVBAR (FIXED TOP: 0)                       │
│  [PS] PERFUSENSE.       [ LIVE ]  [ HISTORY ]  [ ZONES ]     [BED 07]  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌───────────────────────┐                         ┌───────────────────────┐
│     HOVER SIDEBAR     │                         │      MAIN CANVAS      │
│  - Monitor            │                         │                       │
│  - Bed Roster         │                         │  [Active Screen View] │
│  - Turn Schedule      │                         │  • Live (Full Grid)   │
│  - Zones              │                         │  • History (Schedule) │
│  - Sensor Mat (64CH)  │                         │  • Zones (Timers)     │
└───────────────────────┘                         │  • Sensor Mat (Map)   │
                                                  └───────────────────────┘
```

- **What It Does**: Provides an immediate, clean view of real-time patient contact pressure, turn countdowns, anatomical zone limits, and sensor grid health.
- **Target Audience**: Bedside ICU and ward nurses, wound-care specialists, and clinical nurse leads.
- **Key Value**: Replaces mechanical complexity with actionable clinical signals: who needs turning, which pressure zones are loaded, and when the last offload was performed.

---

## 2. User Experience & Visual Design

### Screen-by-Screen Layout Specifications

#### 1. Top Navbar (`Header.tsx`)
- Sits at `top-0` (the top black marquee is removed).
- Retains the exact brand lockup: `[PS] PERFUSENSE.`.
- Navigation items: `LIVE`, `HISTORY`, and `ZONES` (the `SETTINGS` button is removed).
- Right-side cluster: Bed ID indicator (`BED 07 / ID A-204`), Shift Lead (`RN K. NYGÅRD`), and user avatar. The rotated `[HEATING UP]` badge is removed for visual simplicity.

#### 2. Live Monitor Page (`LiveHeatmapView.tsx`)
- **Top Patient Strip**: Clean horizontal summary: Patient name (`ELEANOR V.`), Age (`76`), Braden Score (`12 - HIGH RISK`), and sensor status.
- **Full-Width Live Heatmap Card**:
  - Centered 8×8 sensor pressure grid with color-coded levels: Normal (`#f1fcf9`), Moderate (`#a3cfc9`), Heavy (`#1d635d`), and Hot Spot (`#8b2635`).
  - Adjacent clean metadata rail showing active piezos (`64/64`), peak pressure (`68.4 mmHg`), detected position (`RIGHT LATERAL`), and selected cell inspector.
  - No decorative `[SAMPLE DATA]` stickers or mechanical stamps.
- **Turn Alert & 8-Hour Posture Chronology**:
  - Clean `FLIP TIME` prompt with actionable turn buttons (`DONE, TURNED` and `SNOOZE 5 MIN`).
  - 8-hour posture timeline showing Back, Left, and Right dwell hours with time ticks.
- **Bedside Verification Bar**: One-click action to log turns and export EHR audit.

#### 3. Zones Page (`ZonesView.tsx` / `PeakAlertsView.tsx`)
- Now exclusively houses the **Zone Timers & Anatomical Dwell Analysis**:
  - 6 Anatomical rows: Sacrum & Coccyx, Calcaneus (Heels), Left Trochanter, Shoulders / Scapulae, Right Trochanter, and Occiput.
  - Each zone has an elapsed time bar, limit ratio (`112 / 120 MIN`), status indicator, and clinical limit threshold notice (`LIMIT: 2.0H`).
  - Integrated `PROTOCOL EDIT` affordance to customize turn cadence.

#### 4. Sensor Mat Hardware Page (`SensorHardwareView.tsx`)
- Clean header: `SENSOR MAT TOPOLOGY // BED 07`.
- Primary component: The interactive **64-Piezo Cell Topology Map**.
  - 8×8 piezo array with coordinate indexing (`R1-C1` through `R8-C8`).
  - Click-to-inspect sensor voltage transduction and signal baseline.
  - Nominal, Warning, and Peak status legend.
- Extraneous elements removed:
  - Raw BLE packet latency and microclimate humidity cards.
  - Hardware noise floor audio equalizer bars.
  - Raw MCU UART terminal log feed.

#### 5. Hover Flyout Sidebar (`Sidebar.tsx`)
- Opens flush directly under the top navbar (`top-14 sm:top-16`).
- Clean, compact list:
  1. `Monitor` (links to Live)
  2. `Bed Roster` (all ward beds)
  3. `Turn Schedule` (shift timeline)
  4. `Zones` (anatomical timers)
  5. `Sensor Mat Hardware` (the exclusive entry point to the 64-cell topology map)

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Approach | Rationale |
| :--- | :--- | :--- |
| **Remove Top Black Marquee** | Full removal of the `h-7` fixed ticker | Frees up vertical height, eliminates redundant scrolling ticker text, and anchors the brand navbar at screen top. |
| **Zone Timers to Zones Page** | Move zone progress bars to Zones view | Prevents the Live page from feeling overcrowded while giving dwell timers the dedicated focus they require. |
| **Live Page Expansion** | Full-width clinical card format | Gives the 8×8 pressure grid and posture timeline maximum breathing room. |
| **Settings Simplification** | Isolate 64-Piezo Topology Map | Nurses need to inspect sensor health without being overwhelmed by UART logs or RF noise floors. |
| **Navbar Settings Removal** | Kept in Sidebar only | Keeps top navigation focused on high-frequency clinical tasks (`LIVE`, `HISTORY`, `ZONES`). |

---

## 4. Technical Architecture & Component Mapping

```
                               ┌───────────────────┐
                               │      App.tsx      │
                               │  (State Manager)  │
                               └─────────┬─────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
                 ▼                       ▼                       ▼
          ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
          │ Header.tsx  │         │ Sidebar.tsx │         │ Modals.tsx  │
          │  (top: 0)   │         │ (top: 56px) │         │ (Turn / EHR)│
          └─────────────┘         └─────────────┘         └─────────────┘
                                         │
             ┌───────────────────────────┼───────────────────────────┐
             │                           │                           │
             ▼                           ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
    │LiveHeatmapView  │         │    ZonesView    │         │SensorHardware   │
    │- Full Heatmap   │         │- 6 Zone Timers  │         │- 64-Piezo Map   │
    │- Posture History│         │- Cadence Limits │         │- Cell Inspector │
    │- Flip Time Alert│         │- Protocol Edit  │         │                 │
    └─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Component State & Transition Plan

1. **`Header.tsx`**:
   - Remove `<div className="fixed top-0 ... bg-[#121c1b] ...">`.
   - Update `<header>` position from `top-7` to `top-0`.
   - Remove `SETTINGS` button from `<nav>`.
   - Remove `[HEATING UP]` sticker.
2. **`Sidebar.tsx`**:
   - Update `top-[84px] sm:top-[92px]` to `top-14 sm:top-16` (matching navbar height without the ticker).
   - Maintain links to `monitor`, `bed-roster`, `turn-schedule`, `peak-alerts` (Zones), and `sensor-mat-hardware`.
3. **`App.tsx`**:
   - Update content wrapper padding from `pt-24 sm:pt-28` to `pt-16 sm:pt-20`.
   - Pass zone timer data and handlers to `PeakAlertsView` (or rename component to `ZonesView.tsx`).
4. **`LiveHeatmapView.tsx`**:
   - Remove the `Zone Timers` right card.
   - Expand the Live Heatmap container into an expansive, centered clinical card.
   - Retain the Posture Chronology and Flip Time action box underneath.
   - Strip all non-essential stamps (`[SAMPLE DATA]`, etc.).
5. **`PeakAlertsView.tsx` (Zones View)**:
   - Cleanly replace the complex telemetry spike graph and breach cards with the clear, high-contrast **Zone Timers** matrix.
   - Provide protocol adjustment controls.
6. **`SensorHardwareView.tsx`**:
   - Remove top 4 mini metric cards, noise floor equalizer, and UART event log.
   - Focus exclusively on the **64-Piezo Cell Topology Map** and the **Cell Telemetry Inspector**.
