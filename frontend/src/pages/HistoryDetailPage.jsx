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
    if (!window.confirm('Hapus riwayat ini secara permanen?')) return
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
    <div className="max-w-4xl mx-auto space-y-4 px-4">
      <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
      <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
      <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
    </div>
  )

  if (error || !data) return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-700 font-medium">{error ?? 'Data tidak ditemukan.'}</p>
        <button onClick={() => navigate('/history')} className="mt-3 text-sm text-blue-600 hover:underline">
          ← Kembali
        </button>
      </div>
    </div>
  )

  // Build maps
  const matchedMap = {}
  for (const c of data.matched) matchedMap[c.mapped_to] = c.column_name
  const missingSet = new Set(data.missing.map(c => c.column_name))
  const totalTarget = data.matched.length + data.missing.length
  const pct = totalTarget > 0 ? Math.round((data.matched.length / totalTarget) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 pb-10 space-y-5">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <button onClick={() => navigate('/history')} className="hover:text-blue-600 transition-colors">
          Riwayat
        </button>
        <span>/</span>
        <span className="text-slate-600 truncate max-w-sm">{data.original_name}</span>
      </div>

      {/* ── Info & stats ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Top bar warna sesuai status */}
        <div className={`h-1 w-full ${data.missing.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />

        <div className="p-5">
          {/* Judul + tombol hapus */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-slate-800 text-base truncate">{data.original_name}</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(data.uploaded_at), "d MMMM yyyy, HH:mm", { locale: localeId })}
                  {data.sheet_name && <> · Sheet: <span className="text-slate-600">{data.sheet_name}</span></>}
                </p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500
                border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting
                ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              }
              Hapus
            </button>
          </div>

          {/* 4 stat */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Total Kolom',    value: data.total_columns, color: 'bg-slate-50 text-slate-700 border-slate-200' },
              { label: 'Berhasil',       value: data.matched.length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Tidak Ditemukan', value: data.missing.length, color: 'bg-red-50 text-red-700 border-red-200' },
              { label: 'Tidak Relevan',  value: data.irrelevant.length, color: 'bg-slate-50 text-slate-500 border-slate-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg border px-3 py-2.5 text-center ${s.color}`}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {totalTarget > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Kelengkapan kolom target</span>
                <span className="font-semibold">{data.matched.length}/{totalTarget} ({pct}%)</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : '#f59e0b' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabel 10 kolom target ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Status 10 Kolom Target</h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Ditemukan
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" /> Tidak ada
            </span>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TARGET_COLS.map(col => {
            const found    = col in matchedMap
            const original = matchedMap[col]
            return (
              <div
                key={col}
                className={`rounded-lg px-3 py-2.5 border text-center
                  ${found
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'}`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {found
                    ? <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    : <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  }
                  <span className={`text-xs font-semibold ${found ? 'text-emerald-700' : 'text-red-600'}`}>
                    {col}
                  </span>
                </div>
                {found && original !== col && (
                  <p className="text-xs text-emerald-500 truncate" title={original}>
                    ← {original}
                  </p>
                )}
                {!found && (
                  <p className="text-xs text-red-400">Tidak ditemukan</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Kolom Tidak Relevan ── */}
      {data.irrelevant.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700 text-sm">Kolom Tidak Relevan</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {data.irrelevant.length} kolom
            </span>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {data.irrelevant.map((c, i) => (
              <span key={i}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                {c.column_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Back ── */}
      <button
        onClick={() => navigate('/history')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Riwayat
      </button>
    </div>
  )
}
