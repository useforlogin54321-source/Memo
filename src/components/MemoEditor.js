'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { sbFetch, FIRM_IDS, fmt, GST_RATE, debounce, loadFirmData } from './supabase'
import { useToast } from './Toast'

export default function MemoEditor({ config, onBack }) {
  const memoType = config?.memoType || 'sale'
  const editMemo = config?.editMemo  || null

  const toast = useToast()

  const [firm, setFirm]           = useState(config?.firm || 'Bombay Hosiery')
  const [gstOn, setGstOn]         = useState(editMemo?.gst_enabled || false)
  const [customer, setCustomer]   = useState({ name: editMemo?.customer_name || '', phone: editMemo?.customer_phone || '' })
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [items, setItems]         = useState(config?.items || [])
  const [saving, setSaving]       = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [savedMemo, setSavedMemo] = useState(editMemo || null)
  const [firmData, setFirmData]   = useState(null)
  const [selectedResult, setSelectedResult] = useState(-1)

  const nameRef      = useRef()
  const phoneRef     = useRef()
  const searchRef    = useRef()
  const itemsRef     = useRef(items)
  const savedMemoRef = useRef(savedMemo)
  const resultsRef   = useRef(results)
  const firmDataRef  = useRef(firmData)

  useEffect(() => { itemsRef.current     = items    }, [items])
  useEffect(() => { savedMemoRef.current = savedMemo }, [savedMemo])
  useEffect(() => { resultsRef.current   = results  }, [results])
  useEffect(() => { firmDataRef.current  = firmData }, [firmData])

  const isBombay = firm === 'Bombay Hosiery'
  const isEdit   = !!editMemo
  const isGstOn  = !isBombay && gstOn

  useEffect(() => { loadFirmData(firm).then(setFirmData).catch(() => {}) }, [firm])
  useEffect(() => { nameRef.current?.focus() }, [])

  // Load items when editing an existing memo
  useEffect(() => {
    if (!isEdit || !editMemo?.id) return
    sbFetch(`/memo_items?memo_id=eq.${editMemo.id}&select=*,products(id,sku,name,size,category,hsn_code)`)
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return
        setItems(rows.map((i) => ({
          product_id: i.product_id,
          name:       i.products?.name     || '—',
          sku:        i.products?.sku      || '—',
          size:       i.products?.size     || '',
          hsn_code:   i.products?.hsn_code || '6101',
          unit_price: i.unit_price,
          quantity:   i.quantity,
        })))
      })
      .catch(() => toast.error('Could not load memo items'))
  }, [isEdit, editMemo?.id])

  // Debounced product search
  const doSearch = useCallback(
    debounce(async (q) => {
      if (!q.trim()) { setResults([]); setSelectedResult(-1); return }
      try {
        const data = await sbFetch(
          `/products?or=(name.ilike.*${encodeURIComponent(q)}*,sku.ilike.*${encodeURIComponent(q)}*,category.ilike.*${encodeURIComponent(q)}*)&select=id,sku,name,category,size,price,hsn_code&limit=8`
        )
        setResults(Array.isArray(data) ? data : [])
        setSelectedResult(-1)
      } catch {
        setResults([])
      }
    }, 250),
    []
  )

  useEffect(() => { doSearch(query) }, [query, doSearch])

  function addItem(product) {
    setItems((prev) => {
      const ex = prev.find((i) => i.product_id === product.id)
      if (ex) return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        product_id: product.id,
        name:       product.name,
        sku:        product.sku,
        size:       product.size,
        hsn_code:   product.hsn_code || '6101',
        unit_price: product.price,
        quantity:   1,
      }]
    })
    setQuery(''); setResults([]); setSelectedResult(-1)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function updateQty(productId, qty) {
    if (qty < 1) { setItems((prev) => prev.filter((i) => i.product_id !== productId)); return }
    setItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i))
  }

  function handleSearchKey(e) {
    if (resultsRef.current.length === 0) return
    if      (e.key === 'ArrowDown') { e.preventDefault(); setSelectedResult((p) => Math.min(p + 1, resultsRef.current.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedResult((p) => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); if (selectedResult >= 0) addItem(resultsRef.current[selectedResult]); else if (resultsRef.current.length === 1) addItem(resultsRef.current[0]) }
    else if (e.key === 'Escape')    { setResults([]); setQuery('') }
  }

  function handleNameKey(e)  { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus() } }
  function handlePhoneKey(e) { if (e.key === 'Enter') { e.preventDefault(); searchRef.current?.focus() } }

  // Global keyboard shortcuts
  const saveMemoRef = useRef(null)
  useEffect(() => {
    function handleGlobal(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!savedMemoRef.current && itemsRef.current.length) saveMemoRef.current?.()
      }
      if (e.key === 'Escape' && resultsRef.current.length === 0) {
        if (itemsRef.current.length > 0 && !savedMemoRef.current) {
          if (!confirm('Discard unsaved items and go back?')) return
        }
        onBack()
      }
    }
    window.addEventListener('keydown', handleGlobal)
    return () => window.removeEventListener('keydown', handleGlobal)
  }, [onBack])

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const gstAmt   = isGstOn ? subtotal * GST_RATE : 0
  const total    = subtotal + gstAmt

  // ── PDF generation via Vercel Python function ─────────────────────────────
  async function openPdf(memo, fd) {
    setGeneratingPdf(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo,
          items: itemsRef.current,
          firm,
          firmData: fd || firmDataRef.current,
          customer,
          subtotal,
          gstAmt,
          total,
          memoType,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.success('PDF opened in new tab')
    } catch (err) {
      toast.error(`PDF failed: ${err.message}`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ── Save memo ────────────────────────────────────────────────────────────
  async function saveMemo() {
    if (!items.length) { toast.error('Add at least one product first.'); return }
    setSaving(true)
    try {
      let memo
      const fd = firmDataRef.current

      if (isEdit) {
        await sbFetch(`/memos?id=eq.${editMemo.id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: JSON.stringify({
            customer_name:  customer.name,
            customer_phone: customer.phone,
            gst_enabled:    isGstOn,
            total_amount:   total,
            subtotal_amount: subtotal,
            gst_amount:     gstAmt,
          }),
        })
        await sbFetch(`/memo_items?memo_id=eq.${editMemo.id}`, { method: 'DELETE' })
        memo = editMemo
      } else {
        const res = await sbFetch('/memos', {
          method: 'POST',
          prefer: 'return=representation',
          body: JSON.stringify({
            firm_id:        FIRM_IDS[firm],
            customer_name:  customer.name,
            customer_phone: customer.phone,
            gst_enabled:    isGstOn,
            total_amount:   total,
            subtotal_amount: subtotal,
            gst_amount:     gstAmt,
            memo_type:      memoType,
          }),
        })
        memo = Array.isArray(res) ? res[0] : res
      }

      await sbFetch('/memo_items', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify(
          items.map((i) => ({
            memo_id:    memo.id,
            product_id: i.product_id,
            quantity:   i.quantity,
            unit_price: i.unit_price,
          }))
        ),
      })

      setSavedMemo(memo)
      setSaving(false)
      toast.success(isEdit ? 'Memo updated!' : 'Memo saved!')

      // Auto-open PDF
      await openPdf(memo, fd)
    } catch (err) {
      toast.error(`Save failed: ${err.message}`)
      setSaving(false)
    }
  }

  useEffect(() => { saveMemoRef.current = saveMemo }, [saveMemo])

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function buildWhatsAppText() {
    return [
      `*${firm} — ${memoType === 'order' ? 'Order Memo' : 'Sale Memo'}*`,
      `Customer: ${customer.name || 'N/A'} | ${customer.phone || 'N/A'}`, '',
      ...items.map((i) => `• ${i.name}${i.size ? ` (${i.size})` : ''} × ${i.quantity} = ${fmt(i.unit_price * i.quantity)}`), '',
      ...(!isGstOn
        ? [`Subtotal: ${fmt(subtotal)}`]
        : [`CGST 2.5%: ${fmt(gstAmt / 2)}`, `SGST 2.5%: ${fmt(gstAmt / 2)}`]),
      `*Total: ${fmt(total)}*`,
    ].join('\n')
  }

  function openWhatsApp() {
    const phone = customer.phone?.replace(/\D/g, '')
    if (!phone) {
      navigator.clipboard?.writeText(buildWhatsAppText())
        .then(() => toast.info('No phone number — message copied to clipboard!'))
        .catch(() => toast.error('No phone number saved.'))
      return
    }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(buildWhatsAppText())}`, '_blank')
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="pb-6 min-h-screen">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/[0.08]">←</button>
          <h1 className="text-base font-bold text-white">{isEdit ? '✏️ Edit Memo' : memoType === 'order' ? '📦 New Order' : '💰 New Sale'}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 font-semibold">{memoType.toUpperCase()}</span>
          <div className="ml-auto hidden md:flex items-center gap-3 text-xs text-zinc-600">
            <span><kbd className="bg-white/[0.05] px-1.5 py-0.5 rounded text-zinc-500">↑↓</kbd> navigate</span>
            <span><kbd className="bg-white/[0.05] px-1.5 py-0.5 rounded text-zinc-500">Enter</kbd> add</span>
            <span><kbd className="bg-white/[0.05] px-1.5 py-0.5 rounded text-zinc-500">Ctrl+S</kbd> save + PDF</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* LEFT */}
          <div className="space-y-5">
            {/* Firm selector */}
            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">Firm</p>
              <div className="flex rounded-2xl bg-black/30 p-1.5 gap-1">
                {['Bombay Hosiery', 'Ace Apparel'].map((f) => (
                  <button key={f}
                    onClick={() => { setFirm(f); setGstOn(false); setSavedMemo(null) }}
                    className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${firm === f ? 'bg-sky-300/15 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.2)]' : 'text-zinc-400 hover:text-white'}`}>
                    {f}
                  </button>
                ))}
              </div>
              {!isBombay && (
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-xs text-zinc-400">GST @ 5% (CGST+SGST)</span>
                  <button onClick={() => setGstOn((p) => !p)} className={`relative h-7 w-12 rounded-full transition ${gstOn ? 'bg-emerald-500/80' : 'bg-zinc-700'}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${gstOn ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Customer</p>
                <p className="text-[11px] text-zinc-600">Enter moves to next field</p>
              </div>
              <div className="space-y-3">
                <input ref={nameRef} value={customer.name} onChange={(e) => setCustomer((p) => ({ ...p, name: e.target.value }))} onKeyDown={handleNameKey}
                  placeholder="Name (optional)" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-300/40" />
                <input ref={phoneRef} value={customer.phone} onChange={(e) => setCustomer((p) => ({ ...p, phone: e.target.value }))} onKeyDown={handlePhoneKey}
                  placeholder="Phone (optional)" type="tel" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-300/40" />
              </div>
            </div>

            {/* Summary */}
            {items.length > 0 && (
              <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">Summary</p>
                <div className="space-y-3 text-sm text-zinc-300">
                  {!isGstOn && <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>}
                  {isGstOn && <>
                    <div className="flex justify-between"><span>Taxable</span><span>{fmt(subtotal)}</span></div>
                    <div className="flex justify-between"><span>CGST 2.5%</span><span>{fmt(gstAmt / 2)}</span></div>
                    <div className="flex justify-between"><span>SGST 2.5%</span><span>{fmt(gstAmt / 2)}</span></div>
                  </>}
                  <div className="flex justify-between border-t border-white/10 pt-3 text-base font-bold text-white">
                    <span>Total</span><span>{fmt(total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {items.length > 0 && (
              <div className="space-y-3">
                {!savedMemo ? (
                  <button onClick={saveMemo} disabled={saving || generatingPdf}
                    className="w-full rounded-2xl bg-sky-400 px-4 py-3.5 text-sm font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-60 transition">
                    {saving ? 'Saving…' : generatingPdf ? 'Generating PDF…' : isEdit ? '💾  Update → PDF' : '💾  Save → PDF (Ctrl+S)'}
                  </button>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button onClick={() => openPdf(savedMemo, firmData)} disabled={generatingPdf}
                        className="rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60 transition">
                        {generatingPdf ? 'Generating…' : '🧾  View PDF'}
                      </button>
                      <button onClick={openWhatsApp}
                        className="rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-white hover:bg-emerald-400 transition">
                        📲  WhatsApp
                      </button>
                    </div>
                    <button
                      onClick={() => { setItems([]); setSavedMemo(null); setCustomer({ name: '', phone: '' }); setQuery(''); setTimeout(() => nameRef.current?.focus(), 50) }}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-white/[0.08] transition">
                      + New Memo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Add Products</p>
                <p className="hidden text-[11px] text-zinc-600 sm:block">Arrow keys + Enter</p>
              </div>
              <div className="relative">
                <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleSearchKey}
                  placeholder="Search by name, SKU, category…"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-300/40" />
                {results.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
                    {results.map((product, idx) => (
                      <button key={product.id} onClick={() => addItem(product)}
                        className={`flex w-full items-start justify-between gap-4 border-b border-white/6 px-4 py-3 text-left last:border-b-0 ${selectedResult === idx ? 'bg-sky-300/12' : 'hover:bg-white/[0.04]'}`}>
                        <div>
                          <p className="text-sm font-semibold text-white">{product.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{product.category || '—'} · Sz {product.size || '—'}</p>
                        </div>
                        <p className="text-sm font-bold text-zinc-100 shrink-0">{fmt(product.price)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {items.length > 0 ? (
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/80">
                <div className="border-b border-white/8 bg-black/20 px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Items ({items.length})</p>
                </div>
                <div className="divide-y divide-white/6">
                  {items.map((item) => (
                    <div key={item.product_id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{item.size ? `Sz ${item.size} · ` : ''}{fmt(item.unit_price)} each</p>
                        </div>
                        <p className="text-sm font-bold text-zinc-100 shrink-0">{fmt(item.unit_price * item.quantity)}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-bold text-zinc-200 hover:bg-white/[0.1]">−</button>
                        <span className="w-8 text-center text-sm font-semibold text-white">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-bold text-zinc-200 hover:bg-white/[0.1]">+</button>
                        <button onClick={() => updateQty(item.product_id, 0)} className="ml-auto text-xs font-semibold text-red-400 hover:text-red-300">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/12 bg-zinc-900/60 px-8 py-16 text-center">
                <p className="text-sm text-zinc-400">Search and add products above</p>
                <p className="mt-2 text-xs text-zinc-600">Use arrow keys and Enter to move quickly.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
