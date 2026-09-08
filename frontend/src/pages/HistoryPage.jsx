import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchHistory, fetchHistoryDetail, fetchColumnPreview, deleteHistory } from '../api/excel'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// 10 kolom target — urutan tetap
const TARGET_COLS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]

// ── Ikon status ──────────────────────────────────────────────
function ColIcon({ status, title }) {
  if (status === 'matched') return (
    <span title={title}>
      <svg className="w-5 h-5 text-emerald-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    </span>
  )
  return (
    <span title={title}>
      <svg className="w-5 h-5 text-red-400 mx-auto" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    </span>
  )
}

// ── Modal preview isi kolom ──────────────────────────────────
function PreviewModal({ uploadId, targetCol, colInfo, onClose }) {
  const [data, setData]       = useState(null)   // { column_name, values }
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchColumnPreview(uploadId)
      .then(preview => {
        if (cancelled) return
        setData(preview[targetCol] ?? null)
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat data. File mungkin sudah dihapus dari server.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [uploadId, targetCol])

  // Tutup saat klik backdrop
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-base">{targetCol}</h2>
            {data?.column_name && data.column_name !== targetCol && (
              <p className="text-xs text-slate-400 mt-0.5">
                Header di Excel: <span className="font-medium text-slate-600">{data.column_name}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
              text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <div className="space-y-2 py-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-5 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (i % 4) * 10}%` }} />
              ))}
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !data && (
            <div className="py-6 text-center">
              <p className="text-slate-400 text-sm">Kolom ini tidak ditemukan di file Excel.</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <p className="text-xs text-slate-400 mb-3">{data.values.length} baris data</p>
              <div className="space-y-1">
                {data.values.map((val, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-3 py-1.5 rounded-lg text-sm
                      ${val === '' ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className="text-slate-300 text-xs w-8 text-right flex-shrink-0 mt-0.5 font-mono">
                      {i + 1}
                    </span>
                    {val === '' ? (
                      <span className="text-amber-400 italic text-xs">(kosong)</span>
                    ) : (
                      <span className="text-slate-700 break-all">{val}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100
              hover:bg-slate-200 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Satu baris riwayat (accordion) ──────────────────────────
function HistoryRow({ item, onDelete, deleting }) {
  const navigate = useNavigate()
  const [open, setOpen]               = useState(false)
  const [detail, setDetail]           = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  // modal preview: { targetCol, colInfo }
  const [preview, setPreview]         = useState(null)

  const toggle = async () => {
    if (!open && !detail) {
      setLoadingDetail(true)
      try {
        const d = await fetchHistoryDetail(item.id)
        setDetail(d)
      } catch { /* ignore */ }
      finally { setLoadingDetail(false) }
    }
    setOpen(prev => !prev)
  }

  // Build map: targetName -> { status, columnName }
  const colMap = useCallback(() => {
    if (!detail) return {}
    const map = {}
    for (const c of detail.matched) map[c.mapped_to] = { status: 'matched', columnName: c.column_name }
    for (const c of detail.missing) map[c.mapped_to] = { status: 'missing', columnName: c.column_name }
    return map
  }, [detail])

  const map = colMap()
  const matchScore = `${item.matched_count}/${item.matched_count + item.missing_count}`

  return (
    <>
      {/* Modal */}
      {preview && (
        <PreviewModal
          uploadId={item.id}
          targetCol={preview.targetCol}
          colInfo={preview.colInfo}
          onClose={() => setPreview(null)}
        />
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-3 shadow-sm">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 text-blue-700
            text-xs font-bold flex items-center justify-center">
            #{item.id}
          </span>

          <div className="flex-1 min-w-0">
            <span className="font-semibold text-slate-800 text-sm">
              {format(new Date(item.uploaded_at), "dd MMM yyyy, HH.mm", { locale: localeId })}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">1 file</span>
              {item.status === 'partial' && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {item.missing_count} tidak lengkap
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
              disabled={deleting}
              className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg
                hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              {deleting ? '...' : 'Hapus'}
            </button>
            <button
              onClick={toggle}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium
                text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {loadingDetail ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
              {open ? 'Tutup' : 'Buka'}
            </button>
          </div>
        </div>

        {/* Tabel accordion */}
        {open && (
          <div className="border-t border-slate-100 overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="text-left px-3 py-2 font-medium w-48 sticky left-0 bg-slate-700 z-10">File</th>
                  <th className="px-3 py-2 font-medium text-center w-16">Match</th>
                  {TARGET_COLS.map(col => {
                    const info   = map[col]
                    const status = info ? info.status : 'missing'
                    return (
                      <th
                        key={col}
                        onClick={() => {
                          if (status === 'matched') {
                            setPreview({ targetCol: col, colInfo: info })
                          }
                        }}
                        className={`px-2 py-2 font-medium text-center whitespace-nowrap
                          ${status === 'matched' ? 'cursor-pointer hover:bg-slate-600' : 'opacity-60'}`}
                        title={status === 'matched' ? `Klik untuk lihat isi kolom ${col}` : `Kolom ${col} tidak ditemukan`}
                      >
                        {col.toUpperCase()}
                      </th>
                    )
                  })}
                  <th className="px-3 py-2 font-medium text-center">Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50 border-t border-slate-100">
                  {/* File name */}
                  <td className="px-3 py-3 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 truncate max-w-[160px]" title={item.original_name}>
                          {item.original_name.length > 18
                            ? item.original_name.slice(0, 18) + '...'
                            : item.original_name}
                        </p>
                        {item.sheet_name && (
                          <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {item.sheet_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Match score */}
                  <td className="px-3 py-3 text-center font-semibold text-slate-700">{matchScore}</td>

                  {/* Ikon per kolom — bisa diklik jika matched */}
                  {TARGET_COLS.map(col => {
                    const info   = map[col]
                    const status = info ? info.status : 'missing'
                    return (
                      <td
                        key={col}
                        className={`px-2 py-3 text-center ${status === 'matched' ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (status === 'matched') setPreview({ targetCol: col, colInfo: info })
                        }}
                        title={status === 'matched'
                          ? `Klik untuk lihat isi kolom "${info.columnName}"`
                          : `Tidak ditemukan`}
                      >
                        <ColIcon
                          status={status}
                          title={status === 'matched' ? info.columnName : 'Tidak ditemukan'}
                        />
                      </td>
                    )
                  })}

                  {/* Detail */}
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => navigate(`/history/${item.id}`)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Ditemukan — klik untuk lihat isi
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Tidak ditemukan
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════
export default function HistoryPage() {
  const navigate = useNavigate()
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [deleting, setDeleting] = useState(null)

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory()
      setList(data)
    } catch {
      setError('Gagal memuat riwayat. Pastikan backend berjalan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus riwayat upload ini?')) return
    setDeleting(id)
    try {
      await deleteHistory(id)
      setList(prev => prev.filter(u => u.id !== id))
    } catch {
      alert('Gagal menghapus. Coba lagi.')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-3 p-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">{error}</p>
        <button onClick={loadHistory} className="mt-3 text-sm text-blue-600 hover:underline">Coba lagi</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Upload</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Klik session untuk lihat tabel ringkasan kolom per file.
          </p>
        </div>
        <button
          onClick={loadHistory}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600
            border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Empty */}
      {list.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 font-medium">Belum ada riwayat upload</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Sekarang
          </button>
        </div>
      )}

      {/* List */}
      <div>
        {list.map(item => (
          <HistoryRow
            key={item.id}
            item={item}
            onDelete={handleDelete}
            deleting={deleting === item.id}
          />
        ))}
      </div>
    </div>
  )
}
