/**
 * Badge kecil untuk status / kategori kolom.
 * variant: 'matched' | 'missing' | 'irrelevant' | 'success' | 'partial' | 'failed'
 */
const VARIANTS = {
  matched:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  missing:    'bg-red-100 text-red-700 border border-red-200',
  irrelevant: 'bg-slate-100 text-slate-600 border border-slate-200',
  success:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  partial:    'bg-amber-100 text-amber-700 border border-amber-200',
  failed:     'bg-red-100 text-red-700 border border-red-200',
}

export default function Badge({ variant = 'irrelevant', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANTS[variant] ?? VARIANTS.irrelevant}`}>
      {children}
    </span>
  )
}
