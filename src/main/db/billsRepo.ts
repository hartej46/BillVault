import { getDatabase } from './database'
import { Bill, BillItem, VendorRule } from '../../shared/types'

export class BillsRepository {
  static getSettings(): Record<string, string> {
    const db = getDatabase()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return settings
  }

  static setSetting(key: string, value: string): void {
    const db = getDatabase()
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  static getBillsCount(): number {
    const db = getDatabase()
    const res = db.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number }
    return res.count
  }

  static listBills(): Bill[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM bills ORDER BY created_at DESC').all() as any[]
    return rows.map((row) => ({
      ...row,
      warnings: row.warnings ? JSON.parse(row.warnings) : []
    }))
  }

  static insertBill(bill: Omit<Bill, 'id'>, items?: BillItem[]): Bill {
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT INTO bills (
        file_path, file_hash, status, vendor_name, vendor_gstin,
        bill_number, bill_date, place_of_supply_state, taxable_amount,
        cgst, sgst, igst, cess, total_amount, category, payment_mode,
        confidence, warnings, raw_model_output, created_at, updated_at
      ) VALUES (
        @file_path, @file_hash, @status, @vendor_name, @vendor_gstin,
        @bill_number, @bill_date, @place_of_supply_state, @taxable_amount,
        @cgst, @sgst, @igst, @cess, @total_amount, @category, @payment_mode,
        @confidence, @warnings, @raw_model_output, @created_at, @updated_at
      )
    `)

    const info = insert.run({
      ...bill,
      warnings: JSON.stringify(bill.warnings || [])
    })

    const newId = Number(info.lastInsertRowid)

    if (items && items.length > 0) {
      const insertItem = db.prepare(`
        INSERT INTO bill_items (bill_id, description, hsn_sac, quantity, rate, gst_rate, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const it of items) {
        insertItem.run(newId, it.description, it.hsn_sac || null, it.quantity || null, it.rate || null, it.gst_rate || null, it.amount || null)
      }
    }

    return {
      id: newId,
      ...bill,
      items: items || []
    }
  }

  static getVendorRule(vendorKey: string): string | null {
    const db = getDatabase()
    const row = db.prepare('SELECT default_category FROM vendor_rules WHERE vendor_key = ?').get(vendorKey) as { default_category: string } | undefined
    return row ? row.default_category : null
  }

  static setVendorRule(vendorKey: string, category: string): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO vendor_rules (vendor_key, default_category)
      VALUES (?, ?)
      ON CONFLICT(vendor_key) DO UPDATE SET default_category = excluded.default_category
    `).run(vendorKey, category)
  }
}
