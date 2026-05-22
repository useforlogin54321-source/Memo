'use client'
import { useState, useEffect } from 'react'
import { sbFetch, fmt } from './supabase'
import { useToast } from './Toast'

export default function ReportsPage({ onBack }) {
  const [reportType, setReportType] = useState('sales')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setDateFrom(today)
    setDateTo(today)
  }, [])

  async function fetchReport() {
    setLoading(true)
    try {
      let query = `/memos?created_at=gte.${dateFrom}T00:00:00&created_at=lte.${dateTo}T23:59:59&select=*,firms(name)`
      const res = await sbFetch(query)
      setData(res || [])
    } catch (err) {
      toast.error('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  const fieldClassName = 'rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-sky-300/40'

  return (
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/85 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">←</button>
          <div>
            <h1 className="text-base font-bold text-white">Reports</h1>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Sales and payment analysis</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap gap-4 mb-8 items-end bg-zinc-900/50 p-6 rounded-[28px] border border-white/10">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={fieldClassName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={fieldClassName} />
          </div>
          <button onClick={fetchReport} disabled={loading} className="rounded-xl bg-sky-400 px-6 py-2 text-sm font-bold text-slate-950 hover:bg-sky-300 transition disabled:opacity-50">
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/80 shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Firm</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-white">{row.firms?.name}</td>
                  <td className="px-6 py-4 text-zinc-300">{row.customer_name || 'Walk-in'}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      row.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 
                      row.payment_status === 'partial' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {row.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white">{fmt(row.total_amount)}</td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center text-zinc-500">No data found for selected range.</td>
                </tr>
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="border-t border-white/10 bg-white/[0.02]">
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-right font-semibold text-zinc-400">Total</td>
                  <td className="px-6 py-4 text-right font-mono text-lg font-bold text-sky-400">
                    {fmt(data.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
