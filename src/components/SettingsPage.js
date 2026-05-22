'use client'
import { useState, useEffect, useRef } from 'react'
import { sbFetch, uploadToStorage, parseCsvLine } from './supabase'
import { useToast } from './Toast'
import { useTheme } from '@/contexts/ThemeContext'

export default function SettingsPage({ onBack }) {
  const [activeFirm, setActiveFirm] = useState('Bombay Hosiery')
  const [firmData, setFirmData]     = useState(null)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [csvStatus, setCsvStatus]   = useState('')
  const [uploading, setUploading]   = useState({ logo: false, qr: false })
  const { theme, toggleTheme }      = useTheme()

  const toast  = useToast()
  const logoRef = useRef()
  const qrRef   = useRef()
  const csvRef  = useRef()

  useEffect(() => {
    setFirmData(null)
    sbFetch(`/firms?name=eq.${encodeURIComponent(activeFirm)}&select=*`)
      .then((data) => data?.[0] && setFirmData({ ...data[0] }))
      .catch(() => toast.error('Could not load firm data'))
  }, [activeFirm])

  async function handleUpload(file, field) {
    setUploading((prev) => ({ ...prev, [field]: true }))
    try {
      const ext  = file.name.split('.').pop()
      const path = `${activeFirm.replace(/\s/g, '_')}/${field}_${Date.now()}.${ext}`
      const url  = await uploadToStorage(path, file)
      setFirmData((prev) => ({ ...prev, [field === 'logo' ? 'logo_url' : 'qr_code_url']: url }))
      toast.success(`${field === 'logo' ? 'Logo' : 'QR code'} uploaded!`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }))
    }
  }

  async function saveFirm() {
    if (!firmData) return
    setSaving(true)
    try {
      await sbFetch(`/firms?id=eq.${firmData.id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({
          address:       firmData.address,
          phone_number:  firmData.phone_number,
          footer_note:   firmData.footer_note,
          gst_number:    firmData.gst_number,
          logo_url:      firmData.logo_url,
          qr_code_url:   firmData.qr_code_url,
          logo_size:     firmData.logo_size,
          logo_position: firmData.logo_position,
        }),
      })
      setSaved(true)
      toast.success('Settings saved!')
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      toast.error(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleCsv(e) {
    const file = e.target.files[0]
    if (!file) return
    setCsvStatus('Parsing…')

    try {
      const text    = await file.text()
      const lines   = text.trim().split('\n').filter((l) => l.trim())
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ''))

      const rows = lines.slice(1)
        .map((line) => {
          const vals = parseCsvLine(line)
          return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']))
        })
        .filter((row) => row.sku?.trim())

      if (rows.length === 0) {
        setCsvStatus('No valid rows found. Make sure the CSV has a SKU column.')
        return
      }

      setCsvStatus(`Upserting ${rows.length} products…`)

      const payload = rows.map((row) => ({
        sku:       row.sku.trim(),
        name:      row.name?.trim()     || '',
        category:  row.category?.trim() || '',
        size:      row.size?.trim()     || '',
        price:     parseFloat(row.price)     || 0,
        stock_qty: parseInt(row.stock_qty || row.qty || '0') || 0,
        hsn_code:  row.hsn_code?.trim() || '6101',
      }))

      await sbFetch('/products', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        headers: { 'on-conflict': 'sku' },
        body: JSON.stringify(payload),
      })

      setCsvStatus(`✅ ${payload.length} products upserted.`)
      toast.success(`${payload.length} products imported!`)
    } catch (err) {
      setCsvStatus(`❌ Error: ${err.message}`)
      toast.error(`CSV import failed: ${err.message}`)
    } finally {
      if (csvRef.current) csvRef.current.value = ''
    }
  }

  const fieldClassName = 'w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-300/40'

  return (
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/85 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">←</button>
            <div>
              <h1 className="text-base font-bold text-white">Settings</h1>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Branding and inventory setup</p>
            </div>
          </div>
          <button onClick={toggleTheme} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08]">
            {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-zinc-900/70 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] sm:max-w-md">
          <div className="flex rounded-[22px] bg-black/30 p-1.5">
            {['Bombay Hosiery', 'Ace Apparel'].map((firm) => (
              <button key={firm} onClick={() => setActiveFirm(firm)}
                className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold transition ${activeFirm === firm ? 'bg-sky-300/15 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.2)]' : 'text-zinc-400 hover:text-white'}`}>
                {firm}
              </button>
            ))}
          </div>
        </div>

        {!firmData && <p className="py-16 text-center text-sm text-zinc-500">Loading…</p>}

        {firmData && (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Business Info</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Address</label>
                    <input value={firmData.address || ''} onChange={(e) => setFirmData(p => ({...p, address: e.target.value}))} className={fieldClassName} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Phone</label>
                    <input value={firmData.phone_number || ''} onChange={(e) => setFirmData(p => ({...p, phone_number: e.target.value}))} className={fieldClassName} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">GST Number</label>
                    <input value={firmData.gst_number || ''} onChange={(e) => setFirmData(p => ({...p, gst_number: e.target.value}))} className={fieldClassName} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Footer Note</label>
                    <input value={firmData.footer_note || ''} onChange={(e) => setFirmData(p => ({...p, footer_note: e.target.value}))} className={fieldClassName} />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Bulk Product Upload</p>
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-zinc-400">
                  <p className="font-semibold text-zinc-300 mb-1">CSV columns (header row required):</p>
                  <p>sku, name, category, size, price, stock_qty, hsn_code</p>
                </div>
                <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
                <button onClick={() => csvRef.current.click()}
                  className="mt-4 w-full rounded-2xl border border-dashed border-white/12 bg-white/[0.03] py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">
                  Upload CSV
                </button>
                {csvStatus && (
                  <p className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs font-medium text-zinc-300">{csvStatus}</p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Branding</p>
                <div className="mt-4 space-y-5">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Logo</label>
                    {firmData.logo_url && (
                      <img src={firmData.logo_url} alt="logo" className="mb-3 h-20 rounded-2xl border border-white/8 bg-black/20 p-2 object-contain" />
                    )}
                    <input ref={logoRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], 'logo')} />
                    <button onClick={() => logoRef.current.click()} disabled={uploading.logo}
                      className="w-full rounded-2xl border border-dashed border-white/12 bg-white/[0.03] py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                      {uploading.logo ? 'Uploading…' : 'Upload Logo'}
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Logo Size (px)</label>
                      <input type="number" value={firmData.logo_size || 80}
                        onChange={(e) => setFirmData((prev) => ({ ...prev, logo_size: parseInt(e.target.value) }))}
                        className={fieldClassName} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Position</label>
                      <select value={firmData.logo_position || 'left'}
                        onChange={(e) => setFirmData((prev) => ({ ...prev, logo_position: e.target.value }))}
                        className={fieldClassName}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Payment QR Code</label>
                    {firmData.qr_code_url && (
                      <img src={firmData.qr_code_url} alt="qr" className="mb-3 h-24 w-24 rounded-2xl border border-white/8 bg-black/20 p-2 object-contain" />
                    )}
                    <input ref={qrRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], 'qr')} />
                    <button onClick={() => qrRef.current.click()} disabled={uploading.qr}
                      className="w-full rounded-2xl border border-dashed border-white/12 bg-white/[0.03] py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                      {uploading.qr ? 'Uploading…' : 'Upload QR Code'}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={saveFirm} disabled={saving}
                className={`w-full rounded-2xl px-4 py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${saved ? 'bg-emerald-500 text-white' : 'bg-sky-400 text-slate-950 hover:bg-sky-300'}`}>
                {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
