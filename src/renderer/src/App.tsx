import React, { useEffect, useState } from 'react'
import {
  ShieldCheck,
  Cpu,
  Database,
  PlusCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderOpen
} from 'lucide-react'
import { Bill } from '../../shared/types'

export default function App(): React.JSX.Element {
  const [ipcStatus, setIpcStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [appVersion, setAppVersion] = useState<string>('')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isInserting, setIsInserting] = useState<boolean>(false)
  const [notification, setNotification] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      if (window.billsort) {
        const pingRes = await window.billsort.ping()
        if (pingRes === 'pong') {
          setIpcStatus('connected')
        }

        const ver = await window.billsort.getAppVersion()
        setAppVersion(ver)

        const st = await window.billsort.getSettings()
        setSettings(st)

        const allBills = await window.billsort.listBills()
        setBills(allBills)
      } else {
        setIpcStatus('error')
      }
    } catch (err) {
      console.error('Error connecting to backend:', err)
      setIpcStatus('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateTestBill = async () => {
    try {
      setIsInserting(true)
      const newBill = await window.billsort.createTestBill()
      setBills((prev) => [newBill, ...prev])
      showNotification(`Inserted test bill #${newBill.bill_number} into SQLite!`)
    } catch (err) {
      console.error('Failed to insert test bill:', err)
      showNotification('Error writing to database')
    } finally {
      setIsInserting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-bold text-slate-950 text-lg tracking-wider">
            BS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">BillSort</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                Phase 1: Skeleton
              </span>
            </div>
            <p className="text-xs text-slate-400">Offline AI Bill Extraction & GST Assistant</p>
          </div>
        </div>

        {/* Badges & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% Offline · Zero Cloud Calls</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 text-xs">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Target: {settings.model_name || 'qwen2.5vl:7b'}</span>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Refresh database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Notification Toast */}
        {notification && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2 animate-fade-in shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Phase 1 Verification Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: IPC Round-trip status */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>IPC Bridge</span>
              {ipcStatus === 'connected' ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              ) : ipcStatus === 'checking' ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400">
                  <AlertTriangle className="w-4 h-4" /> Disconnected
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-white">contextBridge Active</div>
            <p className="text-xs text-slate-400">
              Renderer communicating with Main process via secure typed preload API (nodeIntegration disabled, contextIsolation enabled).
            </p>
          </div>

          {/* Card 2: SQLite DB Status */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>SQLite Storage</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span>{bills.length} Bills in DB</span>
            </div>
            <p className="text-xs text-slate-400">
              `better-sqlite3` initialized in WAL mode. Tables: <code className="text-slate-300">bills</code>, <code className="text-slate-300">bill_items</code>, <code className="text-slate-300">vendor_rules</code>, <code className="text-slate-300">settings</code>.
            </p>
          </div>

          {/* Card 3: Model Target */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Local Model Config</span>
              <Cpu className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">
              {settings.model_name || 'qwen2.5vl:7b'}
            </div>
            <p className="text-xs text-slate-400">
              State Code: <code className="text-slate-300">{settings.buyer_state || '27'}</code> | Ollama: <code className="text-slate-300">http://127.0.0.1:11434</code>
            </p>
          </div>
        </section>

        {/* Database Read/Write Verification Action */}
        <section className="bg-slate-900/30 rounded-2xl border border-slate-800/80 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>Phase 1 Verification: SQLite Read/Write Round-Trip</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Clicking the button sends an IPC call to the main process to insert a bill record and items into SQLite, then re-queries and renders the updated list.
              </p>
            </div>

            <button
              onClick={handleCreateTestBill}
              disabled={isInserting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isInserting ? 'Writing to DB...' : 'Insert Test Bill to SQLite'}</span>
            </button>
          </div>

          {/* Table of Bills in SQLite */}
          {bills.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 font-medium text-sm">No bills saved yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Click "Insert Test Bill to SQLite" above to test the database write and read round-trip.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4 text-right">Taxable (₹)</th>
                    <th className="py-3 px-4 text-right">CGST (₹)</th>
                    <th className="py-3 px-4 text-right">SGST (₹)</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {bills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-4 text-slate-400">#{b.id}</td>
                      <td className="py-3 px-4 font-sans text-slate-200">{b.bill_date}</td>
                      <td className="py-3 px-4 font-sans font-medium text-white">{b.vendor_name}</td>
                      <td className="py-3 px-4 text-slate-400">{b.vendor_gstin}</td>
                      <td className="py-3 px-4 text-right">₹{b.taxable_amount?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">₹{b.cgst?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">₹{b.sgst?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-white">₹{b.total_amount?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-3 text-xs text-slate-500 flex items-center justify-between">
        <div>BillSort v{appVersion || '0.1.0'} · Hackathon Edition</div>
        <div className="flex items-center gap-4">
          <span>Ollama Engine: 127.0.0.1:11434</span>
          <span>Zero Cloud Telemetry</span>
        </div>
      </footer>
    </div>
  )
}
