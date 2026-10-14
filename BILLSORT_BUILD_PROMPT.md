# BillSort — Build Prompt & Checkpoint File

> Paste this whole file to your AI coding assistant (Cursor / Claude Code) at the start.
> Keep it in the repo root as `BUILD_PROMPT.md`. The assistant must update the
> **Progress Log** at the bottom after every completed step.

---

## 0. Your role

You are a senior full-stack engineer helping a solo student developer ship a
**production-quality, fully offline desktop app** for a hackathon in a few days.
Work in small, verifiable steps. After each step: run it, confirm it works, update
the Progress Log, then move on. Prefer simple, boring, reliable solutions over clever ones.
If a decision is ambiguous, pick the simplest option, note it in the log, and continue.
Ask me only when a choice is truly blocking.

---

## 1. Hackathon context (why this project exists)

**Theme: "Side Hustle"** — build something with open-weight models / open-source AI
that someone would actually pay for. Small, specific, useful. The open pieces must be
what makes the project work.

Judging story we must be able to tell:
- Runs on a laptop with **no internet**.
- **Client financial data never leaves the machine.**
- **Zero marginal cost per bill**, so a low monthly price is profitable.
- Open model can be swapped / tuned for messy Indian bill formats.
- Where the open, local approach beats a closed cloud API.

Bonus: land a real first user (a freelancer, small shop owner, or CA), let them use
it, and report whether they would pay and what they asked for next.

---

## 2. Product: BillSort

**One-line pitch:** Drop in photos or PDFs of messy bills; BillSort reads them with a
local AI model, fills in GST details, sorts them, and exports a clean month-end sheet
your CA can use. Nothing ever leaves your laptop.

**Target users:** Indian freelancers, small shop owners, and small CA practices who
collect bills as photos/PDFs and re-type them into spreadsheets or Tally every month.

**Core user flow:**
1. First launch → setup screen checks for the local model runtime and offers to
   download the model (with progress). Works offline after that.
2. User drags in images/PDFs (or picks a folder).
3. App extracts fields from each bill with the local vision model.
4. **Review screen:** bill image on the left, editable extracted fields on the right,
   with validation warnings. User confirms or fixes.
5. Bills are saved to a local database, auto-categorised.
6. Dashboard: filter by month / vendor / category / GST rate; totals.
7. **Export:** CSV (required), GST summary sheet (required), Tally XML (stretch).

---

## 3. Tech stack (use exactly this unless I say otherwise)

- **Electron** + **React** + **TypeScript** + **Vite** (use `electron-vite` or
  `electron-forge` with the Vite template; pick one and stay with it)
- **Tailwind CSS** for styling, one small component library is fine (e.g. shadcn/ui)
- **SQLite** via `better-sqlite3` (main process only), simple migrations
- **Local model runtime: Ollama** (HTTP API at `http://127.0.0.1:11434`)
- **Vision model (primary):** `qwen2.5vl:7b` · **fallback for weak machines:**
  `qwen2.5vl:3b` or `gemma3:4b`. Verify the exact tags exist in the Ollama library
  before hardcoding; make the model name a setting, not a constant.
- **Image handling:** `sharp` (resize, rotate by EXIF, grayscale/contrast boost)
- **PDF → images:** `pdfjs-dist` or `pdf-to-img` (render each page to PNG)
- **Validation:** `zod` for schemas
- **CSV:** `papaparse` or hand-rolled
- **Packaging:** `electron-builder` (macOS .dmg first; Windows .exe if time allows)
- **Dev machine:** Mac. Must run on Apple Silicon.

**Hard rules**
- NO cloud calls. NO telemetry. NO analytics. NO remote fonts/CDNs at runtime.
  The app must work with Wi-Fi off (after the one-time model download).
- All file/DB/model access happens in the **main process**; the renderer talks to it
  through a typed `contextBridge` preload API. `contextIsolation: true`,
  `nodeIntegration: false`.
- Never store API keys; there are none.

---

## 4. Architecture

```
┌──────────────────────── Electron ────────────────────────┐
│ Renderer (React UI)                                       │
│   Setup · Import · Review · Dashboard · Export · Settings │
│        ▲ typed IPC via preload (contextBridge)            │
│ Main process (Node/TS)                                    │
│   ├─ ModelService   → Ollama HTTP API (localhost)         │
│   ├─ ExtractionPipeline (preprocess → prompt → validate)  │
│   ├─ BillRepository → SQLite (better-sqlite3)             │
│   ├─ Exporter       → CSV / GST summary / Tally XML       │
│   └─ FileService    → import, store originals             │
└───────────────────────────────────────────────────────────┘
        │ localhost only
   Ollama server (separate process) → qwen2.5vl
```

Suggested folder layout:
```
src/
  main/        (index.ts, ipc.ts, services/, db/, export/)
  preload/     (index.ts — typed API)
  renderer/    (App.tsx, pages/, components/, hooks/)
  shared/      (types.ts, schemas.ts, gst.ts, categories.ts)
tests/         (unit tests + fixtures/bills/)
BUILD_PROMPT.md
README.md
```

---

## 5. Data model (SQLite)

```sql
CREATE TABLE bills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path     TEXT NOT NULL,          -- copied original, in app data dir
  file_hash     TEXT NOT NULL UNIQUE,   -- sha256, to prevent duplicates
  status        TEXT NOT NULL,          -- 'pending' | 'extracted' | 'reviewed' | 'failed'
  vendor_name   TEXT,
  vendor_gstin  TEXT,
  bill_number   TEXT,
  bill_date     TEXT,                   -- ISO yyyy-mm-dd
  place_of_supply_state TEXT,           -- 2-digit state code
  taxable_amount REAL,
  cgst          REAL,
  sgst          REAL,
  igst          REAL,
  cess          REAL,
  total_amount  REAL,
  category      TEXT,
  payment_mode  TEXT,                   -- cash/upi/card/bank/unknown
  confidence    REAL,                   -- 0..1 overall, from validation
  warnings      TEXT,                   -- JSON array of strings
  raw_model_output TEXT,                -- JSON, for debugging
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT, hsn_sac TEXT, quantity REAL, rate REAL,
  gst_rate REAL, amount REAL
);

CREATE TABLE vendor_rules (            -- learns from user corrections
  vendor_key TEXT PRIMARY KEY,         -- normalised vendor name or GSTIN
  default_category TEXT
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
```

---

## 6. Extraction: schema, prompt, validation

### 6.1 Output schema (enforce with Ollama's structured output `format` JSON schema)
```json
{
  "vendor_name": "string|null",
  "vendor_gstin": "string|null",
  "bill_number": "string|null",
  "bill_date": "YYYY-MM-DD|null",
  "taxable_amount": "number|null",
  "cgst": "number|null",
  "sgst": "number|null",
  "igst": "number|null",
  "cess": "number|null",
  "total_amount": "number|null",
  "payment_mode": "cash|upi|card|bank|unknown",
  "line_items": [
    { "description": "string", "hsn_sac": "string|null", "quantity": "number|null",
      "rate": "number|null", "gst_rate": "number|null", "amount": "number|null" }
  ]
}
```

### 6.2 Prompt (system + user). Keep it in one file `prompts.ts`.
System: *"You extract structured data from Indian purchase bills, invoices and
receipts. Output ONLY valid JSON matching the schema. Never guess: if a field is not
visible, use null. Amounts are in INR as plain numbers (no symbols or commas).
Dates are DD/MM/YYYY on Indian bills — convert to YYYY-MM-DD. GSTIN is exactly 15
characters. If CGST and SGST are present they are normally equal."*

User: the page image(s) + "Extract the fields from this bill."

Call settings: `temperature: 0`, `stream: false`, image sent as base64 in `images`.

### 6.3 Validation rules (in `shared/gst.ts`, fully unit-tested)
- **GSTIN regex:** `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
  plus the **GSTIN checksum** (mod-36 check character). Flag if invalid.
- First two digits of GSTIN = state code (27 = Maharashtra). If vendor state ≠
  buyer state, expect IGST; otherwise CGST+SGST. Flag mismatches.
- **Math check:** `taxable + cgst + sgst + igst + cess ≈ total` within ₹1.
  Line items sum ≈ taxable (within ₹2). Flag otherwise.
- `cgst ≈ sgst` when both present.
- Date must be valid and not in the future; flag if outside the current/previous
  financial year.
- Duplicate detection: same `file_hash`, or same `(vendor_gstin, bill_number)`.
- Each failed rule adds a human-readable warning; `confidence` = 1 minus weighted
  penalties. Bills with warnings go to the top of the Review queue.

### 6.4 Robustness
- Preprocess: auto-rotate (EXIF), downscale longest side to ~1600px, boost contrast.
- Multi-page PDFs: extract each page; send page 1 + last page first (headers/totals);
  merge. If unreliable, process page by page and merge line items.
- If JSON parse/validation fails: retry once with a "fix this JSON" instruction;
  otherwise mark `failed` with the raw output saved.
- Process a queue with concurrency 1 (local model), show per-file progress, allow cancel.
- Auto-categorise: first check `vendor_rules`, then keyword rules in `categories.ts`
  (Fuel, Travel, Food, Software/SaaS, Office, Rent, Utilities, Raw Material, Other).
  Learn: when the user changes a category, upsert into `vendor_rules`.

---

## 7. Screens

1. **Setup:** detect Ollama (`GET /api/tags`). If missing → show clear install
   instructions with a button to open the download page, plus "Check again". If model
   missing → "Download model" using `POST /api/pull` with streaming progress bar.
   Show a green "Offline-ready" badge when done.
2. **Import:** big drag-and-drop zone (images, PDFs, or a whole folder). Shows a
   processing queue with thumbnails and status.
3. **Review:** split view. Left: zoomable bill image. Right: form with all fields,
   warnings highlighted in red/amber, line-items table, Confirm & Next (keyboard
   shortcuts: Enter = confirm, ←/→ = prev/next).
4. **Bills / Dashboard:** table with search + filters (month, vendor, category,
   GST rate, status). Summary cards: total spend, total GST paid (input tax credit),
   bills needing review.
5. **Export:** choose month/date range → "Download CSV", "GST summary",
   (stretch) "Tally XML". Show a preview before saving.
6. **Settings:** model name, buyer GSTIN/state, data folder location, "Delete all data".

Design: clean, calm, professional (accountant-friendly). Light + dark mode.
Show the "100% offline — your data never leaves this computer" message visibly.

---

## 8. Exports

- **CSV:** one row per bill: date, vendor, GSTIN, bill no, taxable, CGST, SGST, IGST,
  cess, total, category, payment mode.
- **GST summary:** grouped by GST rate and by vendor with input-tax-credit totals;
  separate section for bills with missing/invalid GSTIN.
- **Tally XML (stretch):** purchase vouchers importable into Tally Prime. Only
  attempt after everything else works.

---

## 9. Build phases (do in order; each ends with a working demo)

**Phase 1 — Skeleton (get it running)**
- Scaffold Electron + Vite + React + TS + Tailwind, secure preload/IPC, SQLite
  migrations. Hello-world page that reads/writes a DB row.
- ✅ Done when: `npm run dev` opens the app and a test IPC call round-trips.

**Phase 2 — Model integration (the heart)**
- `ModelService`: check Ollama, list models, pull model with progress, run vision chat
  with structured output.
- A dev-only "Test extraction" button: pick one image → see JSON output.
- ✅ Done when: one clean bill photo returns valid JSON locally with Wi-Fi off.

**Phase 3 — Pipeline + validation**
- Preprocessing, PDF support, zod validation, GST/math rules with unit tests,
  retry logic, queue with progress.
- ✅ Done when: a folder of 10 sample bills processes end to end with sensible warnings.

**Phase 4 — Review UI + storage**
- Import screen, Review split view, save to SQLite, duplicate detection,
  vendor-rule learning.
- ✅ Done when: I can import, fix, and confirm bills and they persist after restart.

**Phase 5 — Dashboard + export**
- Bills table with filters, summary cards, CSV + GST summary export.
- ✅ Done when: a month-end CSV opens correctly in Excel/Google Sheets.

**Phase 6 — Polish + packaging**
- Setup/onboarding flow, empty states, errors, dark mode, app icon, About screen,
  `electron-builder` .dmg. Test on a clean user account/machine.
- ✅ Done when: a non-technical person can install and use it without help.

**Phase 7 — Stretch (only if time remains)**
- Tally XML export, Hindi/Marathi bill testing, phone-to-laptop photo upload over
  local Wi-Fi (small local HTTP server + QR code), model benchmark screen.

---

## 10. Testing & sample data

- Create `tests/fixtures/bills/` with 15–20 varied samples: clean GST invoices,
  thermal-paper receipts, handwritten kirana bills, fuel receipts, restaurant bills,
  tilted phone photos, blurry photos, multi-page PDFs, Hindi/Marathi bills.
  **Use synthetic or consented/redacted bills only — never commit real client data.**
- Unit tests (Vitest) for: GSTIN regex + checksum, tax math, date parsing, CSV export,
  categorisation.
- Create a small **accuracy benchmark script**: run all fixtures, compare to
  hand-labelled `expected.json`, print per-field accuracy. We will quote these numbers
  in the hackathon post, and use them to compare models (qwen2.5vl 7b vs 3b vs gemma3).

---

## 11. Hackathon deliverables (keep in mind while building)

- Public GitHub repo with a strong README: problem, demo GIF, install steps,
  architecture, model choices, benchmark table, privacy/offline proof.
- 60–90 second demo video: Wi-Fi turned OFF on screen → drop messy bills → clean
  table → export CSV.
- Post covering: why open models mattered here (privacy, zero cost per bill, tunable
  for Indian formats, no vendor lock-in), where it beat a closed API, honest limits.
- First-user section: who used it, what happened, would they pay (target price
  ₹299–499/month), what they asked for next.

---

## 12. Working rules for the AI assistant

1. Read this whole file before writing code. Re-read the relevant section before each phase.
2. One phase at a time; small commits with clear messages.
3. Run the app and tests yourself after each change; don't claim something works unless you ran it.
4. Never add network calls beyond `127.0.0.1` Ollama (and the one-time model pull via Ollama itself).
5. Don't add large dependencies without noting why in the log.
6. Keep code typed and readable; shared types live in `src/shared`.
7. Handle errors visibly in the UI (no silent failures), and keep user data safe
   (never delete originals without confirmation).
8. After every step, append to the Progress Log below: what was done, what's next,
   any decisions or blockers.

---

## 13. Progress Log (AI maintains this)

| Date | Phase | What was done | Next | Notes / decisions |
|------|-------|---------------|------|-------------------|
| 2026-10-14 | Phase 1 (Skeleton) | Scaffolded Electron + Vite + React + TS + Tailwind. Configured SQLite (`better-sqlite3`) in WAL mode with full data schema (`bills`, `bill_items`, `vendor_rules`, `settings`). Implemented secure preload IPC bridge. Built full GST validation logic (`src/shared/gst.ts`) with mod-36 checksum. Tested roundtrip DB read/write. | Phase 2 (Model Integration) | Native module rebuilt with `@electron/rebuild` (ABI 132); configured test runner with Electron ABI. 13/13 Vitest tests passing. |

**Current status:** Phase 1 complete and verified.
**Next action:** Begin Phase 2 — local Ollama model integration (`ModelService`, tags check, pull stream, vision chat with structured output).
