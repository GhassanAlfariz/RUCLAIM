import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchHistoryDetail, deleteHistory } from '../api/excel'
import ColumnGroupCard from '../components/ColumnGroupCard'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export default function HistoryDetailPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
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
      alert('Gagal menghapus. Coba lagi.')
      setDeleting(false)
    }
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  // ---- Error ----
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-red-700 font-medium">{error ?? 'Data tidak ditemukan.'}</p>
          <button onClick={() => navigate('/history')}
            className="mt-3 text-sm text-blue-600 hover:underline">
            ← Kembali ke Riwayat
          </button>
        </div>
      </div>
    )
  }

  // ---- Transform data untuk ColumnGroupCard ----
  const matchedItems    = data.matched.map(c => ({
    label:    c.column_name,
    sublabel: c.mapped_to !== c.column_name ? c.mapped_to : null,
  }))

  const missingItems    = data.missing.map(c => ({
    label:    c.column_name,
    sublabel: null,
  }))

  const irrelevantItems = data.irrelevant.map(c => ({
    label:    c.column_name,
    sublabel: null,
  }))

  const totalTarget = data.matched.length + data.missing.length

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ---- Breadcrumb ---- */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <button onClick={() => navigate('/history')}
          className="hover:text-blue-600 transition-colors">
          Riwayat
        </button>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 font-medium truncate max-w-xs">{data.original_name}</span>
      </div>

      {/* ---- Info card ---- */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-slate-800 text-lg leading-tight">{data.original_name}</h1>
                <Badge variant={data.status}>
                  {data.status === 'success' ? 'Lengkap'
                    : data.status === 'partial' ? 'Parsial'
                    : 'Gagal'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                <span>
                  📅 {format(new Date(data.uploaded_at), "d MMMM yyyy, HH:mm", { locale: localeId })}
                </span>
                {data.sheet_name && (
                  <span>📄 Sheet: <span className="font-medium text-slate-700">{data.sheet_name}</span></span>
                )}
                <span>🔢 Total kolom: <span className="font-medium text-slate-700">{data.total_columns}</span></span>
              </div>
            </div>
          </div>

          {/* Tombol hapus */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 border border-red-200
              rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {deleting ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Hapus
          </button>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <StatCard label="Total Kolom" value={data.total_columns} color="blue" />
          <StatCard label="Kolom Diambil" value={data.matched.length} color="green" />
          <StatCard label="Tidak Ditemukan" value={data.missing.length} color="red" />
          <StatCard label="Tidak Relevan" value={data.irrelevant.length} color="slate" />
        </div>

        {/* Progress bar kolom target */}
        {totalTarget > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Kelengkapan kolom target</span>
              <span className="font-medium">
                {data.matched.length}/{totalTarget} ({Math.round((data.matched.length / totalTarget) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((data.matched.length / totalTarget) * 100)}%`,
                  backgroundColor: data.missing.length === 0 ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          3 Kelompok Kolom
          ================================================================ */}

      {/* 1. Kolom target yang BERHASIL diambil */}
      <ColumnGroupCard
        title="Kolom Target Berhasil Diambil"
        subtitle="Ditemukan di file dan berhasil dipetakan ke kolom target"
        color="green"
        icon="✅"
        items={matchedItems}
        emptyMessage="Tidak ada kolom target yang berhasil ditemukan."
      />

      {/* 2. Kolom target yang TIDAK ditemukan */}
      <ColumnGroupCard
        title="Kolom Target Tidak Ditemukan"
        subtitle="Kolom ini SEHARUSNYA ada di file tapi tidak terdeteksi"
        color="red"
        icon="❌"
        items={missingItems}
        emptyMessage="Semua kolom target berhasil ditemukan. 🎉"
      />

      {/* 3. Kolom yang tidak relevan / bukan target */}
      <ColumnGroupCard
        title="Kolom Tidak Relevan"
        subtitle="Ada di file tapi bukan merupakan kolom target yang dicari"
        color="slate"
        icon="📋"
        items={irrelevantItems}
        emptyMessage="Tidak ada kolom di luar target."
      />

      {/* Kembali */}
      <div className="pb-6">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Riwayat
        </button>
      </div>

    </div>
  )
}
