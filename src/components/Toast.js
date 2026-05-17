'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((msg, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts((p) => [...p, { id, msg, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration)
  }, [])

  const toast = {
    success: (m, d) => add(m, 'success', d),
    error:   (m, d) => add(m, 'error', d ?? 5000),
    info:    (m, d) => add(m, 'info', d),
  }

  const ICON = { success: '✓', error: '✕', info: 'ℹ' }
  const CLS  = {
    success: 'bg-emerald-500/90 border-emerald-400/40',
    error:   'bg-red-500/90    border-red-400/40',
    info:    'bg-sky-500/90    border-sky-400/40',
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur transition-all ${CLS[t.type]}`}>
            <span className="mt-px shrink-0 text-base leading-none">{ICON[t.type]}</span>
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
