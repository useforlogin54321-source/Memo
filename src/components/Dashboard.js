'use client'
import { useEffect, useState } from 'react'
import { sbFetch, fmt } from './supabase'

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const iso  = today.toISOString()

    sbFetch(`/memos?created_at=gte.${iso}&select=memo_type,total_amount`)
      .then((rows) => {
        if (!Array.isArray(rows)) return
        const sales  = rows.filter((r) => r.memo_type === 'sale')
        const orders = rows.filter((r) => r.memo_type === 'order')
        const rev    = rows.reduce((s, r) => s + Number(r.total_amount), 0)
        setStats({ sales: sales.length, orders: orders.length, revenue: rev, total: rows.length })
      })
      .catch(() => {})   // silently ignore if Supabase not configured yet
  }, [])

  const tiles = [
    { icon: '📦', label: 'New Order',  sub: 'Delivery and school orders', action: () => onNavigate('editor', { memoType: 'order' }) },
    { icon: '💰', label: 'New Sale',   sub: 'Walk-in retail billing',    action: () => onNavigate('editor', { memoType: 'sale'  }) },
    { icon: '📜', label: 'History',    sub: 'Sales and order records',   action: () => onNavigate('history') },
    { icon: '⚙️', label: 'Settings',   sub: 'Branding and products',     action: () => onNavigate('settings') },
  ]

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)] lg:items-stretch">

          {/* LEFT: Brand panel */}
          <section className="rounded-[32px] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8 lg:p-10">
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/60">Built for Harsh Nannaware</p>
            <div className="mt-5 max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">Memo App</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                Fast billing and order management — cleaner workspace, keyboard-first workflow, and instant PDF memos with GST support.
              </p>
            </div>

            {/* Today's stats */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats ? (
                <>
                  <StatCard label="Today's Revenue" value={fmt(stats.revenue)} sub={`${stats.total} memo${stats.total !== 1 ? 's' : ''}`} />
                  <StatCard label="Sales" value={stats.sales}  sub="today" />
                  <StatCard label="Orders" value={stats.orders} sub="today" />
                </>
              ) : (
                <>
                  <StatCard label="Today's Revenue" value="—" />
                  <StatCard label="Sales"  value="—" />
                  <StatCard label="Orders" value="—" />
                </>
              )}
            </div>
          </section>

          {/* RIGHT: Nav tiles */}
          <section className="grid grid-cols-2 gap-4 sm:gap-5">
            {tiles.map((tile) => (
              <button
                key={tile.label}
                onClick={tile.action}
                className="group flex min-h-[220px] flex-col justify-between rounded-[28px] border border-white/10 bg-zinc-900/80 p-5 text-left shadow-[0_16px_44px_rgba(0,0,0,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-300/40 sm:min-h-[240px] sm:p-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-3xl shadow-inner shadow-black/20 transition group-hover:bg-sky-300/10">
                  {tile.icon}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{tile.label}</p>
                  <p className="mt-2 max-w-[16rem] text-xs leading-6 text-zinc-400 sm:text-sm">{tile.sub}</p>
                </div>
              </button>
            ))}
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-[28px] border border-white/8 bg-black/20 px-5 py-4 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Memo App v1.0</p>
          <p>Harsh Nannaware · 📞 7620885178</p>
        </div>
      </div>
    </div>
  )
        }
    
