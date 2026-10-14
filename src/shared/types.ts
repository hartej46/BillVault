export type BillStatus = 'pending' | 'extracted' | 'reviewed' | 'failed'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank' | 'unknown'

export interface BillItem {
  id?: number
  bill_id?: number
  description: string
  hsn_sac?: string | null
  quantity?: number | null
  rate?: number | null
  gst_rate?: number | null
  amount?: number | null
}

export interface Bill {
  id?: number
  file_path: string
  file_hash: string
  status: BillStatus
  vendor_name: string | null
  vendor_gstin: string | null
  bill_number: string | null
  bill_date: string | null // ISO yyyy-mm-dd
  place_of_supply_state: string | null
  taxable_amount: number | null
  cgst: number | null
  sgst: number | null
  igst: number | null
  cess: number | null
  total_amount: number | null
  category: string | null
  payment_mode: PaymentMode | null
  confidence: number | null
  warnings: string[] // parsed from JSON column
  raw_model_output?: string | null
  created_at: string
  updated_at: string
  items?: BillItem[]
}

export interface VendorRule {
  vendor_key: string
  default_category: string
}

export interface AppSettings {
  model_name: string
  buyer_gstin: string
  buyer_state: string
  data_dir: string
  theme: 'light' | 'dark' | 'system'
}

export interface BillSortAPI {
  ping: () => Promise<string>
  getAppVersion: () => Promise<string>
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<boolean>
  getBillsCount: () => Promise<number>
  listBills: () => Promise<Bill[]>
  createTestBill: () => Promise<Bill>
}

declare global {
  interface Window {
    billsort: BillSortAPI
  }
}
