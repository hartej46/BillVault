import { ipcMain, app } from 'electron'
import { BillsRepository } from './db/billsRepo'
import { Bill } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('billsort:ping', async () => {
    return 'pong'
  })

  ipcMain.handle('billsort:getAppVersion', async () => {
    return app.getVersion()
  })

  ipcMain.handle('billsort:getSettings', async () => {
    return BillsRepository.getSettings()
  })

  ipcMain.handle('billsort:setSetting', async (_, key: string, value: string) => {
    BillsRepository.setSetting(key, value)
    return true
  })

  ipcMain.handle('billsort:getBillsCount', async () => {
    return BillsRepository.getBillsCount()
  })

  ipcMain.handle('billsort:listBills', async () => {
    return BillsRepository.listBills()
  })

  ipcMain.handle('billsort:createTestBill', async () => {
    const timestamp = new Date().toISOString()
    const testBill: Omit<Bill, 'id'> = {
      file_path: '/dummy/test-bill.png',
      file_hash: `test-hash-${Date.now()}`,
      status: 'extracted',
      vendor_name: 'Shree Ganesh Stationery & Xerox',
      vendor_gstin: '27AAPFU0939F1ZV',
      bill_number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      bill_date: new Date().toISOString().slice(0, 10),
      place_of_supply_state: '27',
      taxable_amount: 500.0,
      cgst: 45.0,
      sgst: 45.0,
      igst: 0.0,
      cess: 0.0,
      total_amount: 590.0,
      category: 'Office',
      payment_mode: 'upi',
      confidence: 0.98,
      warnings: [],
      raw_model_output: JSON.stringify({ note: 'Sample offline test extraction' }),
      created_at: timestamp,
      updated_at: timestamp
    }

    return BillsRepository.insertBill(testBill, [
      {
        description: 'A4 Paper Ream (75 GSM)',
        hsn_sac: '4802',
        quantity: 2,
        rate: 250,
        gst_rate: 18,
        amount: 500
      }
    ])
  })
}
