/**
 * Card yang menampilkan satu kelompok kolom (matched / missing / irrelevant).
 */
export default function ColumnGroupCard({ title, subtitle, color, icon, items, emptyMessage }) {
  const colorMap = {
    green:  { header: 'bg-emerald-50 border-emerald-200', title: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    red:    { header: 'bg-red-50 border-red-200',         title: 'text-red-700',     chip: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
    slate:  { header: 'bg-slate-50 border-slate-200',     title: 'text-slate-700',   chip: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400' },
  }
  const c = colorMap[color] ?? colorMap.slate

  return (
    <div className={`rounded-xl border-2 ${c.header} overflow-hidden`}>
      {/* Header card */}
      <div className={`px-4 py-3 border-b ${c.header} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <p className={`font-semibold text-sm ${c.title}`}>{title}</p>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.chip}`}>
          {items.length}
        </span>
      </div>

      {/* Body */}
      <div className="p-3 bg-white">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">{emptyMessage}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${c.header}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className="text-slate-700">{item.label}</span>
                {item.sublabel && (
                  <span className="text-slate-400">→ {item.sublabel}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
