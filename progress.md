# BillSort — Progress Log & Activity Tracker

> **Mandatory Rule for every session/chat:**
> Always read `BILLSORT_BUILD_PROMPT.md` and `progress.md` at the start of every chat turn.
> Record every single detail, architectural choice, dependency addition, bug fix, and milestone completed into this file.

---

## 📌 Project Overview
- **App Name:** BillSort
- **Pitch:** 100% offline desktop app for Indian freelancers, small shop owners, and CAs to scan/drop messy bills/PDFs, extract GST details with local AI (Ollama + Qwen2.5-VL), validate tax math, sort & auto-categorise, and export clean sheets.
- **Strict Privacy Rule:** Zero network calls, zero telemetry, zero cloud APIs. Financial data never leaves the laptop. Runs with Wi-Fi disabled.

---

## ⚙️ Environment Discovery & Pre-requisites
- **Operating System:** macOS (Apple Silicon / Darwin arm64)
- **Node.js:** v22.18.0
- **npm:** 10.9.3
- **Git:** Initialized in repository (`/Users/hartej/Hartej46/Hactober/Week2`)
- **Ollama:** Installed at `/usr/local/bin/ollama` (Service not currently running, will be detected/managed by setup screen)

---

## 🗓️ Phase Roadmap & Current Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1: Skeleton** | Electron + Vite + React + TypeScript + Tailwind CSS + SQLite (`better-sqlite3`) + typed IPC bridge | **✅ Completed & Verified** |
| **Phase 2: Model Integration** | `ModelService` talking to local Ollama (`127.0.0.1:11434`), structured JSON schema extraction, test UI | **Next Up** |
| **Phase 3: Pipeline & Validation** | `sharp` preprocessing, PDF page rendering, Zod schemas, GSTIN mod-36 & math validation, retry & queue | Upcoming |
| **Phase 4: Review UI & Storage** | Split-screen review (zoomable bill + editable fields), SQLite persistence, duplicate detection, vendor rules | Upcoming |
| **Phase 5: Dashboard & Export** | Bills table with filtering, summary cards, CSV export, GST summary sheet | Upcoming |
| **Phase 6: Polish & Packaging** | Onboarding/setup screen, offline badge, dark/light themes, keyboard shortcuts, `electron-builder` .dmg | Upcoming |
| **Phase 7: Stretch** | Tally Prime XML export, multi-language/regional bill testing, local Wi-Fi mobile transfer | Stretch |

---

## 📝 Detailed Change Log

### [2026-10-14] — Initialization & Workspace Setup
- Initialized empty git repository.
- Inspected development machine environment (Node v22.18.0, npm 10.9.3, Ollama installed at `/usr/local/bin/ollama`).
- Created `progress.md` to track all changes, architecture, and step-by-step progress.
- Created `AGENTS.md` to enforce the rule: every new chat/agent MUST read `BILLSORT_BUILD_PROMPT.md` and `progress.md`.

### [2026-10-14] — Phase 1: Skeleton Completed & Verified
- **Dependencies Installed & Configured:**
  - `electron` (v34.2.0)
  - `electron-vite` (v2.3.0), `vite` (v5.4.14), `@vitejs/plugin-react`
  - `react`, `react-dom` (v18.3.1), `@types/react`, `@types/react-dom`
  - `typescript` (v5.7.3), `tailwindcss` (v3.4.17), `postcss`, `autoprefixer`
  - `better-sqlite3` (v11.8.1), `@types/better-sqlite3`
  - `@electron/rebuild` (v3.7.1) for native C++ module compilation against Electron's Node ABI
  - `zod`, `clsx`, `tailwind-merge`, `lucide-react`, `papaparse`, `sharp`, `vitest`
- **Architecture & Codebase Structure:**
  - `src/shared/types.ts`: Defined `Bill`, `BillItem`, `BillStatus`, `PaymentMode`, `AppSettings`, and `BillSortAPI` interfaces.
  - `src/shared/gst.ts`: Implemented Indian GSTIN regex validation, ISO/IEC 7064 Mod-36 checksum verification, state codes lookup, intra/inter-state tax rules, CGST vs SGST symmetry checks, and tax math consistency rules.
  - `src/main/db/schema.ts`: SQLite schema defining tables: `bills`, `bill_items`, `vendor_rules`, `settings`, plus performance indices on `status`, `bill_date`, `vendor_name`.
  - `src/main/db/database.ts`: Database connection manager using `better-sqlite3` in WAL mode (`journal_mode = WAL`, `foreign_keys = ON`), with default settings initialization.
  - `src/main/db/billsRepo.ts`: Data access layer for inserting/querying bills, items, settings, and vendor rules.
  - `src/main/ipc.ts`: IPC handlers for `ping`, `getAppVersion`, `getSettings`, `setSetting`, `getBillsCount`, `listBills`, and `createTestBill`.
  - `src/preload/index.ts`: Secure preload script exposing `window.billsort` via `contextBridge.exposeInMainWorld` (`contextIsolation: true`, `nodeIntegration: false`).
  - `src/renderer/src/App.tsx`: Dark-mode UI displaying live IPC connection status, SQLite connection, real-time bill counts, test bill insertion button, and reactive table view.
  - `src/renderer/src/index.css`: Tailwind configuration with dark styling and custom scrollbars.
  - `electron.vite.config.ts`: Configuration using `externalizeDepsPlugin` for native modules (`better-sqlite3`, `sharp`).
  - `package.json`: Configured with `"type": "module"`, `"rebuild": "electron-rebuild -f -w better-sqlite3"`, and `"test": "ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run"`.
- **Testing & Verification:**
  - Native module rebuild with Electron ABI (132) confirmed working without errors.
  - Ran `npm run dev`: Electron main process and renderer successfully launched and connected to SQLite database at `/Users/hartej/Library/Application Support/billsort/billsort.db`.
  - Ran `npm test`: 13 out of 13 tests passed across 2 test suites (`tests/db.test.ts` and `tests/gst.test.ts`).
  - Ran `npm run build`: Production bundle compiled cleanly in under 2 seconds.
