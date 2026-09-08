export default function StatCard({ label, value, color = 'blue' }) {
  const colorMap = {
    blue:  'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    red:   'text-red-600 bg-red-50',
    slate: 'text-slate-600 bg-slate-50',
  }
  return (
    <div className={`rounded-lg px-4 py-3 ${colorMap[color]} text-center`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-75">{label}</p>
    </div>
  )
}
