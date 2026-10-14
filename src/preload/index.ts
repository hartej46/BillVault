import { contextBridge, ipcRenderer } from 'electron'
import { BillSortAPI } from '../shared/types'

const api: BillSortAPI = {
  ping: () => ipcRenderer.invoke('billsort:ping'),
  getAppVersion: () => ipcRenderer.invoke('billsort:getAppVersion'),
  getSettings: () => ipcRenderer.invoke('billsort:getSettings'),
  setSetting: (key, value) => ipcRenderer.invoke('billsort:setSetting', key, value),
  getBillsCount: () => ipcRenderer.invoke('billsort:getBillsCount'),
  listBills: () => ipcRenderer.invoke('billsort:listBills'),
  createTestBill: () => ipcRenderer.invoke('billsort:createTestBill')
}

// Use `contextBridge` to securely expose Electron APIs to renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('billsort', api)
  } catch (error) {
    console.error('Failed to expose billsort API via contextBridge:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.billsort = api
}
