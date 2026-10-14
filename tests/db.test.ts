import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SCHEMA_SQL } from '../src/main/db/schema'

describe('SQLite Database Schema & Operations', () => {
  let db: Database.Database

  beforeEach(() => {
    // In-memory SQLite for testing
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA_SQL)
  })

  it('initializes tables properly', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name)

    expect(tables).toContain('bills')
    expect(tables).toContain('bill_items')
    expect(tables).toContain('vendor_rules')
    expect(tables).toContain('settings')
  })

  it('inserts and retrieves a bill with items', () => {
    const insertBill = db.prepare(`
      INSERT INTO bills (
        file_path, file_hash, status, vendor_name, vendor_gstin,
        bill_number, bill_date, place_of_supply_state, taxable_amount,
        cgst, sgst, igst, cess, total_amount, category, payment_mode,
        confidence, warnings, raw_model_output, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `)

    const info = insertBill.run(
      '/path/test.png',
      'hash123',
      'extracted',
      'Quick Retail Store',
      '27AAAAA0000A1Z5',
      'INV-001',
      '2026-10-14',
      '27',
      1000,
      90,
      90,
      0,
      0,
      1180,
      'Office',
      'upi',
      0.95,
      JSON.stringify([]),
      '{}',
      new Date().toISOString(),
      new Date().toISOString()
    )

    const billId = Number(info.lastInsertRowid)
    expect(billId).toBeGreaterThan(0)

    const insertItem = db.prepare(`
      INSERT INTO bill_items (bill_id, description, hsn_sac, quantity, rate, gst_rate, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    insertItem.run(billId, 'Stationery paper', '4802', 2, 500, 18, 1000)

    const retrievedBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as any
    expect(retrievedBill.vendor_name).toBe('Quick Retail Store')
    expect(retrievedBill.total_amount).toBe(1180)

    const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(billId) as any[]
    expect(items).toHaveLength(1)
    expect(items[0].description).toBe('Stationery paper')
  })

  it('enforces unique file_hash to prevent duplicate imports', () => {
    const insert = db.prepare(`
      INSERT INTO bills (
        file_path, file_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `)

    insert.run('/p1.png', 'duplicate_hash', 'pending', '2026-10-14', '2026-10-14')

    expect(() => {
      insert.run('/p2.png', 'duplicate_hash', 'pending', '2026-10-14', '2026-10-14')
    }).toThrow(/UNIQUE constraint failed/)
  })

  it('stores and retrieves vendor rules for category learning', () => {
    db.prepare('INSERT INTO vendor_rules (vendor_key, default_category) VALUES (?, ?)').run('uber', 'Travel')

    const rule = db.prepare('SELECT default_category FROM vendor_rules WHERE vendor_key = ?').get('uber') as any
    expect(rule.default_category).toBe('Travel')
  })
})
