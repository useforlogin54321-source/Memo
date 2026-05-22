'use client'
import { useState } from 'react'

export default function PaymentStatusSelector({ value, onChange }) {
  const [paidAmount, setPaidAmount] = useState(value?.paid_amount || 0)
  const [method, setMethod] = useState(value?.payment_method || '')

  const fieldClassName = 'w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-300/40'

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Payment Status</label>
        <select 
          value={value?.payment_status || 'pending'} 
          onChange={(e) => onChange({ ...value, payment_status: e.target.value })}
          className={fieldClassName}
        >
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      {(value?.payment_status === 'paid' || value?.payment_status === 'partial') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Paid Amount</label>
            <input 
              type="number" 
              placeholder="0.00"
              value={paidAmount}
              onChange={(e) => {
                const amt = parseFloat(e.target.value) || 0
                setPaidAmount(amt)
                onChange({ ...value, paid_amount: amt })
              }}
              className={fieldClassName}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Method</label>
            <input 
              type="text" 
              placeholder="Cash/UPI/Card"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value)
                onChange({ ...value, payment_method: e.target.value })
              }}
              className={fieldClassName}
            />
          </div>
        </div>
      )}
    </div>
  )
}
