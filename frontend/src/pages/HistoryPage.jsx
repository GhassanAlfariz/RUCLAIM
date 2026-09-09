import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchHistory, fetchHistoryDetail, deleteHistory } from '../api/excel'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const TARGET_COLS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]

// Ikon centang / silang
function CheckIcon({ ok }) {
  if (ok) return (
    <svg className="w-4 h-4 text-emerald-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 text-slate-300 mx-auto" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

// Spinner kecil
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-slate-400 mx-auto" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

// Satu baris tabel
function TableRow({ item, detailMap, loadingId, onDelete, deleting, navigate }) {
  const isLoadingDetail = loadingId === item.id
  const detail = detailMap[item.id]

  // build colMap dari detail
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
    <tr className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 last:border-0">
      {/* No */}
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs font-bold text-slate-400">#{item.id}</span>
      </td>

      {/* Nama File */}
      <td className="px-3 py-2.5 min-w-[180px]">
        <p className="font-medium text-slate-700 text-xs truncate max-w-[180px]" title={item.original_name}>
          {item.original_name}
        </p>
        <p className="text-slate-400 text-xs mt-0.5">
          {format(new Date(item.uploaded_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
          {item.sheet_name ? ` · ${item.sheet_name}` : ''}
        </p>
      </td>

      {/* Match score */}
      <td className="px-3 py-2.5 text-center">
        <span className={`text-xs font-bold ${item.missing_count === 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
          {matchScore}
        </span>
      </td>

      {/* Kolom target */}
      {TARGET_COLS.map(col => {
        if (isLoadingDetail) return (
          <td key={col} className="px-2 py-2.5 text-center"><Spinner /></td>
        )
        if (!detail) return (
          <td key={col} className="px-2 py-2.5 text-center">
            <span className="w-4 h-1.5 bg-slate-100 rounded block mx-auto" />
          </td>
        )
        const info = map[col]
        const ok = info?.status === 'matched'
        return (
          <td key={col} className="px-2 py-2.5 text-center" title={ok ? info.columnName : 'Tidak ditemukan'}>
            <CheckIcon ok={ok} />
          </td>
        )
      })}

      {/* Aksi */}
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => navigate(`/history/${item.id}`)}
            className="px-2.5 py-1 text-xs text-blue-600 border border-blue-200 rounded-md
              hover:bg-blue-50 transition-colors font-medium"
          >
            Detail
          </button>
          <button
            onClick={() => onDelete(item.id)}
            disabled={deleting}
            className="px-2.5 py-1 text-xs text-red-400 border border-red-200 rounded-md
              hover:bg-red-50 transition-colors"
          >
            {deleting ? '...' : 'Hapus'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [deleting, setDeleting] = useState(null)
  // Map id -> detail data
  const [detailMap, setDetailMap] = useState({})
  // id yang sedang di-fetch detail
  const [loadingIds, setLoadingIds] = useState(new Set())

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory()
      setList(data)
      // Fetch semua detail sekaligus (parallel)
      fetchAllDetails(data)
    } catch {
      setError('Gagal memuat riwayat. Pastikan backend berjalan.')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllDetails = async (items) => {
    const ids = items.map(i => i.id)
    setLoadingIds(new Set(ids))
    const results = await Promise.allSettled(
      ids.map(id => fetchHistoryDetail(id))
    )
    const newMap = {}
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') newMap[ids[idx]] = res.value
    })
    setDetailMap(newMap)
    setLoadingIds(new Set())
  }

  useEffect(() => { loadHistory() }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus riwayat upload ini?')) return
    setDeleting(id)
    try {
      await deleteHistory(id)
      setList(prev => prev.filter(u => u.id !== id))
      setDetailMap(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch {
      alert('Gagal menghapus.')
    } finally {
      setDeleting(null)
    }
  }

  // Hitung ringkasan
  const totalFiles    = list.length
  const totalMatched  = list.reduce((s, i) => s + i.matched_count, 0)
  const totalMissing  = list.reduce((s, i) => s + i.missing_count, 0)
  const totalComplete = list.filter(i => i.missing_count === 0).length

  if (loading) return (
    <div className="max-w-full mx-auto space-y-3 px-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
    </div>
  )

  if (error) return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">{error}</p>
        <button onClick={loadHistory} className="mt-3 text-sm text-blue-600 hover:underline">Coba lagi</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-full mx-auto px-4 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Upload</h1>
          <p className="text-slate-500 text-sm mt-0.5">{totalFiles} file · hover kolom untuk lihat nama header asli</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white
              bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Baru
          </button>
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
      </div>

      {/* ── Stat bar ── */}
      {totalFiles > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total File', value: totalFiles, color: 'text-blue-600 bg-blue-50 border-blue-100' },
            { label: 'File Lengkap', value: totalComplete, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            { label: 'Total Kolom Match', value: totalMatched, color: 'text-violet-600 bg-violet-50 border-violet-100' },
            { label: 'Total Kolom Kurang', value: totalMissing, color: 'text-amber-600 bg-amber-50 border-amber-100' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {list.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <p className="text-slate-500 font-medium">Belum ada riwayat upload</p>
          <button onClick={() => navigate('/')}
            className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Upload Sekarang
          </button>
        </div>
      )}

      {/* ── Tabel gabungan ── */}
      {list.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-3 text-center font-medium w-10">#</th>
                  <th className="px-3 py-3 text-left font-medium min-w-[180px]">File</th>
                  <th className="px-3 py-3 text-center font-medium w-16">Match</th>
                  {TARGET_COLS.map(col => (
                    <th key={col} className="px-2 py-3 text-center font-medium whitespace-nowrap">
                      {col.toUpperCase()}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <TableRow
                    key={item.id}
                    item={item}
                    detailMap={detailMap}
                    loadingId={loadingIds.has(item.id) ? item.id : null}
                    onDelete={handleDelete}
                    deleting={deleting === item.id}
                    navigate={navigate}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Kolom ditemukan
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Tidak ditemukan
            </span>
            <span className="text-slate-400">· Hover kolom untuk lihat nama header asli di Excel</span>
          </div>
        </div>
      )}
    </div>
  )
}
