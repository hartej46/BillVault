export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path     TEXT NOT NULL,
  file_hash     TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL,
  vendor_name   TEXT,
  vendor_gstin  TEXT,
  bill_number   TEXT,
  bill_date     TEXT,
  place_of_supply_state TEXT,
  taxable_amount REAL,
  cgst          REAL,
  sgst          REAL,
  igst          REAL,
  cess          REAL,
  total_amount  REAL,
  category      TEXT,
  payment_mode  TEXT,
  confidence    REAL,
  warnings      TEXT,
  raw_model_output TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT,
  hsn_sac TEXT,
  quantity REAL,
  rate REAL,
  gst_rate REAL,
  amount REAL
);

CREATE TABLE IF NOT EXISTS vendor_rules (
  vendor_key TEXT PRIMARY KEY,
  default_category TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_name);
`
