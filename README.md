# Perfusense — Clinical Pressure Injury Prevention OS

> Continuous pressure ulcer prevention & 64-channel piezoelectric mat telemetry operating system.

---

## 📋 Overview

**Perfusense** is a full-stack clinical bedside operating system engineered for ICU and acute-care wards to eliminate hospital-acquired pressure injuries (HAPIs). It interfaces with 64-channel (8×8) piezoelectric sensor mats, processes real-time load telemetry, drives intelligent clinical turn cadences (Braden scale risk-stratified), and delivers live ward-wide visibility.

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Motion.
- **Backend**: Node.js, Express, TypeScript (`tsx`), Mongoose (MongoDB), Server-Sent Events (SSE).
- **Firmware Integration**: Supports ESP32 64-byte row-major binary frames and JSON payloads via HTTP.
- **Dual-Mode Operation**: Runs in full-stack mode with Express + MongoDB, or in standalone mode with built-in Vite fallback middleware and clinical datasets.

---

## 🎨 Color System & Design Tokens

| Token Name | Hex Code | Role & Clinical Meaning |
| :--- | :--- | :--- |
| **Canvas Background** | `#F1FCF9` | Calming clinical mint/teal background |
| **Card Surface** | `#FFFFFF` | Crisp elevated card surface |
| **Card Border** | `#CCEDE6` | Subtle clinical boundary |
| **Primary Brand** | `#0D9488` | Teal-600 — Primary interactive actions, active navigation |
| **Primary Accent** | `#006A62` | Deep clinical teal — Brand headers and emphasis |
| **Text Primary** | `#131D1C` | High-contrast dark slate for patient details and vitals |
| **Text Secondary** | `#5F7975` | Slate teal for metadata, timestamps, and captions |
| **Status: Optimal / Stable** | `#16A34A` | Green-600 — Adequate offloading, within protocol |
| **Status: Due Now** | `#D97706` | Amber-600 — Turn due within current window |
| **Status: Overdue** | `#DC2626` | Red-600 — Immediate repositioning required |
| **Status: Ambulating** | `#0284C7` | Sky-600 — Patient out of bed / mobile |
| **Pressure: Nominal** | `#22C55E` | Sub-ischemic pressure (< 30 mmHg) |
| **Pressure: Warning** | `#F59E0B` | Moderate capillary compression (30–50 mmHg) |
| **Pressure: Critical** | `#EF4444` | High ischemia risk (> 50 mmHg) |

---

## 🚀 Quick Start on Local Laptop

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB** (optional for standalone preview, required for live persistence):
  - Local MongoDB or Docker:
    ```bash
    docker run -d -p 27017:27017 --name mongo mongo:7
    ```

### 2. Installation
Clone the repository and install all dependencies:
```bash
git clone <your-github-repo-url>
cd perfusense
npm install
```
*(All frontend and backend dependencies are unified in the root `package.json` for one-command installation).*

### 3. Environment Variables
Create your local `.env` from the provided template:
```bash
cp .env.example .env
```

**Secrets Configuration Note**:
Secret values (such as hardware `DEVICE_KEY` and third-party API credentials) are flagged with `secretsPending: true` in `server/config.ts`. The system uses safe development defaults until production secrets are supplied.

### 4. Running the Application

#### Option A: Run Full Stack (Frontend + Backend concurrently)
```bash
npm run dev:all
```
- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000/api](http://localhost:4000/api)
- **API Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

#### Option B: Run Services Separately
- **Frontend only** (with auto-fallback dev middleware):
  ```bash
  npm run dev
  ```
- **Backend only** (with auto-reload):
  ```bash
  npm run server
  ```
- **Reset & Seed Database**:
  ```bash
  npm run seed
  ```

---

## 📦 Package Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Launch Vite frontend on port 3000 |
| `npm run build` | Build optimized production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run server` | Start Express backend in watch mode on port 4000 |
| `npm run server:start` | Run Express backend in single execution mode |
| `npm run dev:all` | Run frontend & backend concurrently with color-coded logs |
| `npm run seed` | Seed MongoDB with 9 clinical beds & audit log history |
| `npm run lint` | TypeScript typecheck frontend (`tsc --noEmit`) |
| `npm run lint:server` | TypeScript typecheck backend (`server/tsconfig.json`) |
| `npm run test:server` | Run backend integration test suite |

---

## 📡 Sensor Mat Telemetry (ESP32 Integration)

The mat firmware posts 64-cell pressure frames (8×8 array) to the backend:

```http
POST /api/telemetry/bed-101/frame
x-device-key: change-me-device-key
Content-Type: application/octet-stream

[64 raw bytes: row-major, 0-255]
```

Or via JSON:
```json
{
  "cells": [0, 12, 45, 120, ...],
  "ts": "2026-10-16T12:00:00.000Z"
}
```

---

## 🛡️ Verification & Code Quality

- Frontend Typecheck: `npm run lint` (0 errors)
- Backend Typecheck: `npm run lint:server` (0 errors)
- Production Build: `npm run build` (Clean compile in < 500ms)
- Dev Proxy & Fallback: Zero `ECONNREFUSED` errors when backend is offline
