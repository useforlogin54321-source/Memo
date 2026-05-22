'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { sbFetch, fmt, GST_RATE, debounce, loadUserFirm } from './supabase'
import { useToast } from './Toast'
import PaymentStatusSelector from './PaymentStatusSelector'

export default function MemoEditor({ config, onBack }) {
  const memoType = config?.memoType || 'sale'
  const editMemo = config?.editMemo  || null

  const toast = useToast()

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
  const [paymentInfo, setPaymentInfo] = useState({
    payment_status: editMemo?.payment_status || 'pending',
    paid_amount: editMemo?.paid_amount || 0,
    payment_method: editMemo?.payment_method || ''
  })

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

  const isEdit   = !!editMemo
  const isGstOn  = gstOn

  useEffect(() => { loadUserFirm().then(setFirmData).catch(() => {}) }, [])
  useEffect(() => { nameRef.current?.focus() }, [])

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
          narration:  i.narration || '',
          description: i.description || ''
        })))
      })
      .catch(() => toast.error('Could not load memo items'))
  }, [isEdit, editMemo?.id])

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
        narration:  '',
        description: ''
      }]
    })
    setQuery(''); setResults([]); setSelectedResult(-1)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function updateItem(idx, key, val) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: val } : item))
  }

  function updateQty(id, q) {
    if (q < 1) { setItems(prev => prev.filter(i => i.product_id !== id)); return }
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, quantity: q } : i))
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

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const gstAmt   = isGstOn ? subtotal * GST_RATE : 0
  const total    = subtotal + gstAmt

  async function openPdf(memo, fd) {
    setGeneratingPdf(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo,
          items: itemsRef.current,
          firmData: fd || firmDataRef.current,
          customer,
          subtotal,
          gstAmt,
          total,
          memoType,
        }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
      a.download = `${customer.name || 'Walk-in'} (${memoType}) ${dateStr}.pdf`
      a.click()
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(`PDF failed: ${err.message}`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function saveMemo() {
    if (!items.length) { toast.error('Add at least one product first.'); return }
    if (!firmData) { toast.error('Please configure your firm settings first.'); return }
    setSaving(true)
    try {
      let memo
      const fd = firmDataRef.current

      let invoice_number = editMemo?.invoice_number
      if (!isEdit) {
        const invRes = await sbFetch(`/rpc/generate_invoice_number`, {
          method: 'POST',
          body: JSON.stringify({ p_tenant_id: fd.id, p_prefix: 'MEMO' })
        })
        invoice_number = invRes
      }

      const memoBody = {
        firm_id:        fd.id,
        customer_name:  customer.name,
        customer_phone: customer.phone,
        gst_enabled:    isGstOn,
        total_amount:   total,
        subtotal_amount: subtotal,
        gst_amount:     gstAmt,
        memo_type:      memoType,
        payment_status: paymentInfo.payment_status,
        paid_amount:    paymentInfo.paid_amount,
        payment_method: paymentInfo.payment_method,
        invoice_number: invoice_number
      }

      if (isEdit) {
        await sbFetch(`/memos?id=eq.${editMemo.id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: JSON.stringify(memoBody),
        })
        await sbFetch(`/memo_items?memo_id=eq.${editMemo.id}`, { method: 'DELETE' })
        memo = { ...editMemo, ...memoBody }
      } else {
        const res = await sbFetch('/memos', {
          method: 'POST',
          prefer: 'return=representation',
          body: JSON.stringify(memoBody),
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
            narration:  i.narration,
            description: i.description
          }))
        ),
      })

      setSavedMemo(memo)
      setSaving(false)
      toast.success(isEdit ? 'Memo updated!' : 'Memo saved!')
      await openPdf(memo, fd)
    } catch (err) {
      toast.error(`Save failed: ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <div className="pb-6 min-h-screen">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/[0.08]">←</button>
          <h1 className="text-base font-bold text-white">{isEdit ? '✏️ Edit Memo' : memoType === 'order' ? '📦 New Order' : '💰 New Sale'}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 font-semibold">{memoType.toUpperCase()}</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">Firm & Payment</p>
              <div className="mb-4">
                <p className="text-sm font-bold text-white">{firmData?.name || 'Loading firm...'}</p>
                <p className="text-xs text-zinc-500">{firmData?.address || ''}</p>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="gst-toggle" checked={gstOn} onChange={(e) => setGstOn(e.target.checked)} className="h-4 w-4 rounded border-white/10 bg-black/25 text-sky-400" />
                <label htmlFor="gst-toggle" className="text-xs font-semibold text-zinc-400">Enable GST (5%)</label>
              </div>
              <PaymentStatusSelector value={paymentInfo} onChange={setPaymentInfo} />
            </div>

            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">Customer</p>
              <div className="space-y-3">
                <input ref={nameRef} value={customer.name} onChange={(e) => setCustomer((p) => ({ ...p, name: e.target.value }))} onKeyDown={handleNameKey}
                  placeholder="Name (optional)" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-300/40" />
                <input ref={phoneRef} value={customer.phone} onChange={(e) => setCustomer((p) => ({ ...p, phone: e.target.value }))} onKeyDown={handlePhoneKey}
                  placeholder="Phone (optional)" type="tel" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-300/40" />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">Add Items</p>
              <div className="relative">
                <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleSearchKey}
                  placeholder="Search by name, SKU, or category…" className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-300/40" />
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                    {results.map((r, i) => (
                      <button key={r.id} onClick={() => addItem(r)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${selectedResult === i ? 'bg-sky-400/10 text-sky-100' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                        <div>
                          <p className="text-sm font-bold">{r.name}</p>
                          <p className="text-[10px] uppercase tracking-wider opacity-60">{r.sku} • {r.category} • {r.size}</p>
                        </div>
                        <p className="text-sm font-mono font-bold">{fmt(r.price)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5 min-h-[400px]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-4">Cart Items ({items.length})</p>
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.product_id} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        <p className="text-[10px] text-zinc-500">{item.sku} • {fmt(item.unit_price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="h-7 w-7 rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white">-</button>
                        <span className="text-sm font-mono w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="h-7 w-7 rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white">+</button>
                      </div>
                    </div>
                    <textarea 
                      value={item.narration || ''} 
                      onChange={(e) => updateItem(idx, 'narration', e.target.value)}
                      placeholder="Add narration/description..."
                      className="w-full mt-2 bg-transparent border-none text-xs text-zinc-400 focus:ring-0 p-0 resize-none h-8"
                    />
                  </div>
                ))}
                {items.length === 0 && <p className="py-20 text-center text-sm text-zinc-600">No items added yet.</p>}
              </div>

              {items.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-5 space-y-2">
                  <div className="flex justify-between text-sm text-zinc-400"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {isGstOn && <div className="flex justify-between text-sm text-zinc-400"><span>GST (5%)</span><span>{fmt(gstAmt)}</span></div>}
                  <div className="flex justify-between text-lg font-bold text-white pt-2"><span>Total</span><span>{fmt(total)}</span></div>
                </div>
              )}
            </div>

            <button onClick={saveMemo} disabled={saving || !items.length}
              className="w-full rounded-[22px] bg-sky-400 py-4 text-sm font-bold text-slate-950 transition hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : 'Save & Download PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
