'use client'
import { useState, useEffect, useMemo } from 'react'
import { Search, Pencil, Trash2, Printer } from 'lucide-react'
import { sbFetch, fmt, loadUserFirm } from './supabase'
import { useToast } from './Toast'

async function fetchItems(memoId) {
  const rows = await sbFetch(
    `/memo_items?memo_id=eq.${memoId}&select=*,products(id,sku,name,size,category,hsn_code)`
  )
  return Array.isArray(rows)
    ? rows.map((item) => ({
        product_id: item.product_id,
        name:       item.products?.name     || '—',
        sku:        item.products?.sku      || '—',
        size:       item.products?.size     || '',
        hsn_code:   item.products?.hsn_code || '6101',
        unit_price: item.unit_price,
        quantity:   item.quantity,
        narration:  item.narration || '',
        description: item.description || ''
      }))
    : []
}

export default function HistoryPage({ onBack, onEdit }) {
  const [memos, setMemos]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('sale')
  const [search, setSearch]       = useState('')
  const [reprintingId, setReprintingId] = useState(null)
  const [firmData, setFirmData] = useState(null)

  const toast = useToast()

  useEffect(() => {
    loadUserFirm().then(setFirmData).catch(() => {})
    
    sbFetch('/memos?select=*,firms(name)&order=created_at.desc&limit=200')
      .then((data) => setMemos(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Could not load memos'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return memos.filter((memo) => {
      if ((memo.memo_type || 'sale') !== tab) return false
      if (!q) return true
      return (
        (memo.customer_name  || '').toLowerCase().includes(q) ||
        (memo.customer_phone || '').includes(q) ||
        new Date(memo.created_at).toLocaleDateString('en-IN').includes(q)
      )
    })
  }, [memos, tab, search])

  const grandTotal = filtered.reduce((sum, memo) => sum + Number(memo.total_amount), 0)

  async function handleReprint(memo) {
    setReprintingId(memo.id)
    try {
      const items    = await fetchItems(memo.id)
      const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
      const gstAmt   = memo.gst_enabled ? subtotal * 0.05 : 0
      const total    = subtotal + gstAmt

      const res = await fetch('/api/generate-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo,
          items,
          firmData,
          customer: { name: memo.customer_name || '', phone: memo.customer_phone || '' },
          subtotal,
          gstAmt,
          total,
          memoType: memo.memo_type || 'sale',
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reprint-${memo.id}.pdf`
      a.click()
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(`Reprint failed: ${err.message}`)
    } finally {
      setReprintingId(null)
    }
  }

  async function handleEdit(memo) {
    try {
      const items = await fetchItems(memo.id)
      onEdit({ memoType: memo.memo_type || 'sale', editMemo: memo, items })
    } catch {
      toast.error('Could not load memo for editing')
    }
  }

  async function handleDelete(memo) {
    if (!confirm(`Delete memo for "${memo.customer_name || 'Walk-in'}"? This cannot be undone.`)) return
    try {
      await sbFetch(`/memo_items?memo_id=eq.${memo.id}`, { method: 'DELETE' })
      await sbFetch(`/memos?id=eq.${memo.id}`, { method: 'DELETE' })
      setMemos((prev) => prev.filter((m) => m.id !== memo.id))
      toast.success('Memo deleted')
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/85 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">←</button>
            <div>
              <h1 className="text-base font-bold text-white">History</h1>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Archive and reprints</p>
            </div>
            {filtered.length > 0 && (
              <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {filtered.length} · {fmt(grandTotal)}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:items-center">
            <div className="flex rounded-2xl bg-black/30 p-1.5">
              {[{ id: 'sale', label: 'Sale Memos' }, { id: 'order', label: 'Order Memos' }].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold transition ${tab === t.id ? 'bg-sky-300/15 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.2)]' : 'text-zinc-400 hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, date…"
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-3 pl-10 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-300/40" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {loading && <p className="py-16 text-center text-sm text-zinc-500">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">{search ? 'No results found.' : 'No memos yet.'}</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((memo) => (
            <div key={memo.id} className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{memo.customer_name || 'Walk-in'}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(memo.created_at).toLocaleString('en-IN')}
                  </p>
                  {memo.customer_phone && <p className="mt-2 text-xs text-zinc-400">☎ {memo.customer_phone}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-zinc-100">{fmt(memo.total_amount)}</p>
                  {memo.gst_enabled && <p className="mt-1 text-xs text-sky-300">GST</p>}
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button onClick={() => handleReprint(memo)} disabled={reprintingId === memo.id}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-white px-3 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60">
                  {reprintingId === memo.id ? 'Loading…' : <><Printer size={12} /> Reprint</>}
                </button>
                <button onClick={() => handleEdit(memo)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08]">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => handleDelete(memo)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/15">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
