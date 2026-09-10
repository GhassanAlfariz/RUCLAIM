import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchHistoryDetail, deleteHistory } from '../api/excel'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const TARGET_COLS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]

export default function HistoryDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchHistoryDetail(id)
      .then(setData)
      .catch(() => setError('Data tidak ditemukan atau server tidak merespons.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!window.confirm('Hapus riwayat upload ini secara permanen?')) return
    setDeleting(true)
    try {
      await deleteHistory(id)
      navigate('/history')
    } catch {
      alert('Gagal menghapus.')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4 p-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  if (error || !data) return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-700">{error ?? 'Data tidak ditemukan.'}</p>
        <button onClick={() => navigate('/history')} className="mt-3 text-sm text-blue-600 hover:underline">
          Kembali ke Riwayat
        </button>
      </div>
    </div>
  )

  const matchedSet = new Set(data.matched.map(c => c.mapped_to))
  const colNameMap = {}
  data.matched.forEach(c => { colNameMap[c.mapped_to] = c.column_name })

  const totalTarget = data.matched.length + data.missing.length
  const pct = totalTarget > 0 ? Math.round((data.matched.length / totalTarget) * 100) : 0
  const isComplete = data.missing.length === 0

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <button onClick={() => navigate('/history')} className="hover:text-blue-600 transition-colors">
          Riwayat
        </button>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 truncate max-w-xs">{data.original_name}</span>
      </div>

      {/* Info card */}
      <div className={`bg-white rounded-xl border-l-4 shadow-sm overflow-hidden
        ${isComplete ? 'border-emerald-400' : 'border-amber-400'}`}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-base">{data.original_name}</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(data.uploaded_at), "d MMMM yyyy, HH:mm", { locale: localeId })}
                  {data.sheet_name && <> · Sheet: <span className="font-medium text-slate-600">{data.sheet_name}</span></>}
                </p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 border border-red-200
                rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Hapus
            </button>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Total Kolom',     value: data.total_columns,    cls: 'text-slate-700 bg-slate-50' },
              { label: 'Berhasil',        value: data.matched.length,   cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Tidak Ditemukan', value: data.missing.length,   cls: 'text-red-500 bg-red-50' },
              { label: 'Tidak Relevan',   value: data.irrelevant.length, cls: 'text-slate-500 bg-slate-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-3 text-center ${s.cls}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs mt-0.5 opacity-75">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Kelengkapan kolom target</span>
              <span className="font-medium">{data.matched.length}/{totalTarget} ({pct}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: isComplete ? '#10b981' : '#f59e0b' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status 10 kolom target */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">Status 10 Kolom Target</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Ditemukan
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Tidak ada
            </span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {TARGET_COLS.map(col => {
            const matched  = matchedSet.has(col)
            const excelCol = colNameMap[col]
            return (
              <div
                key={col}
                className={`rounded-lg border p-3 text-center
                  ${matched
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {matched ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={`text-xs font-semibold ${matched ? 'text-emerald-700' : 'text-red-600'}`}>
                    {col}
                  </span>
                </div>
                <p className={`text-[10px] truncate ${matched ? 'text-emerald-500' : 'text-red-400 italic'}`}
                  title={excelCol}>
                  {matched && excelCol ? `— ${excelCol}` : 'Tidak ditemukan'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Kolom tidak relevan */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800">Kolom Tidak Relevan</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {data.irrelevant.length} kolom
          </span>
        </div>
        {data.irrelevant.length === 0 ? (
          <p className="text-slate-400 text-sm">Tidak ada kolom di luar target.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.irrelevant.map(c => (
              <span key={c.id}
                className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-md">
                {c.column_name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Kembali */}
      <button
        onClick={() => navigate('/history')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors pb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Riwayat
      </button>

    </div>
  )
}
