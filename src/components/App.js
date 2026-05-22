'use client'
import { useState } from 'react'
import { ToastProvider } from './Toast'
import Dashboard from './Dashboard'
import MemoEditor from './MemoEditor'
import HistoryPage from './HistoryPage'
import SettingsPage from './SettingsPage'
import ReportsPage from './ReportsPage'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [editorConfig, setEditorConfig] = useState(null)

  function openEditor(config) {
    setEditorConfig(config)
    setPage('editor')
  }

  return (
    <ToastProvider>
      <div className="relative min-h-screen overflow-hidden theme-transition">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_28%)]" />
        <div className="relative">
          {page === 'dashboard' && <Dashboard onNavigate={(p, cfg) => { if (cfg) openEditor(cfg); else setPage(p) }} />}
          {page === 'editor'    && <MemoEditor config={editorConfig} onBack={() => { setEditorConfig(null); setPage('dashboard') }} />}
          {page === 'history'   && <HistoryPage onBack={() => setPage('dashboard')} onEdit={(cfg) => openEditor(cfg)} />}
          {page === 'settings'  && <SettingsPage onBack={() => setPage('dashboard')} />}
          {page === 'reports'   && <ReportsPage onBack={() => setPage('dashboard')} />}
        </div>
      </div>
    </ToastProvider>
  )
}
