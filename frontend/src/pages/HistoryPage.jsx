import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchHistory, fetchHistoryDetail, deleteHistory } from '../api/excel'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const TARGET_COLS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]

function CheckIcon({ title }) {
  return (
    <span title={title}>
      <svg className="w-4 h-4 text-emerald-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </span>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4 text-slate-300 mx-auto" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [list, setList]           = useState([])
  const [details, setDetails]     = useState({})   // { id: { matched: [...], missing: [...] } }
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [deleting, setDeleting]   = useState(null)

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory()
      setList(data)
      // Fetch detail semua item secara paralel untuk tahu kolom mana yang match
      const detailResults = await Promise.allSettled(
        data.map(item => fetchHistoryDetail(item.id))
      )
      const detailMap = {}
      detailResults.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          detailMap[data[i].id] = res.value
        }
      })
      setDetails(detailMap)
    } catch {
      setError('Gagal memuat riwayat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Hapus riwayat upload ini?')) return
    setDeleting(id)
    try {
      await deleteHistory(id)
      setList(prev => prev.filter(u => u.id !== id))
      setDetails(prev => { const d = { ...prev }; delete d[id]; return d })
    } catch {
      alert('Gagal menghapus.')
    } finally {
      setDeleting(null)
    }
  }

  // Stat aggregate
  const totalFile    = list.length
  const totalLengkap = list.filter(i => i.status === 'success').length
  const totalMatch   = list.reduce((s, i) => s + i.matched_count, 0)
  const totalKurang  = list.reduce((s, i) => s + i.missing_count, 0)

  if (loading) return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
    </div>
  )

  if (error) return (
    <div className="p-6">
      <p className="text-red-600">{error}</p>
      <button onClick={loadHistory} className="mt-2 text-sm text-blue-600 hover:underline">Coba lagi</button>
    </div>
  )

  return (
    <div className="space-y-5 p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Upload</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {totalFile} file · hover kolom untuk lihat nama header asli
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
              bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Baru
          </button>
          <button
            onClick={loadHistory}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
              border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{totalFile}</p>
          <p className="text-xs text-slate-500 mt-1">Total File</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-500">{totalLengkap}</p>
          <p className="text-xs text-slate-500 mt-1">File Lengkap</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-purple-500">{totalMatch}</p>
          <p className="text-xs text-slate-500 mt-1">Total Kolom Match</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{totalKurang}</p>
          <p className="text-xs text-slate-500 mt-1">Total Kolom Kurang</p>
        </div>
      </div>

      {/* Tabel */}
      {list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">Belum ada riwayat upload.</p>
          <button onClick={() => navigate('/')}
            className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            Upload Sekarang
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-4 py-3 font-medium sticky left-0 bg-slate-800 z-10 min-w-[200px]">
                    File
                  </th>
                  <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Match</th>
                  {TARGET_COLS.map(col => (
                    <th key={col} className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                      {col.toUpperCase()}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(item => {
                  const detail = details[item.id]
                  // Build set of matched target names
                  const matchedSet = new Set(
                    detail ? detail.matched.map(c => c.mapped_to) : []
                  )
                  // Build map target -> excel col name (untuk tooltip)
                  const colNameMap = {}
                  if (detail) {
                    detail.matched.forEach(c => { colNameMap[c.mapped_to] = c.column_name })
                  }

                  const score = `${item.matched_count}/${item.matched_count + item.missing_count}`
                  const isPartial = item.status !== 'success'

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* File info */}
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100">
                        <p className="font-medium text-slate-800 truncate max-w-[180px]"
                          title={item.original_name}>
                          {item.original_name}
                        </p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          {format(new Date(item.uploaded_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                          {item.sheet_name ? ` · ${item.sheet_name}` : ''}
                        </p>
                      </td>

                      {/* Match score */}
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold text-sm ${isPartial ? 'text-amber-500' : 'text-emerald-600'}`}>
                          {score}
                        </span>
                      </td>

                      {/* Per kolom target */}
                      {TARGET_COLS.map(col => {
                        const isMatched = matchedSet.has(col)
                        const excelName = colNameMap[col]
                        return (
                          <td key={col} className="px-3 py-3 text-center">
                            {!detail ? (
                              <span className="w-3 h-3 bg-slate-100 rounded-full inline-block animate-pulse" />
                            ) : isMatched ? (
                              <CheckIcon title={excelName ? `${excelName}` : col} />
                            ) : (
                              <XIcon />
                            )}
                          </td>
                        )
                      })}

                      {/* Aksi */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => navigate(`/history/${item.id}`)}
                            className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200
                              rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap"
                          >
                            Detail
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, item.id)}
                            disabled={deleting === item.id}
                            className="px-3 py-1 text-xs font-medium text-red-500 border border-red-200
                              rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {deleting === item.id ? '...' : 'Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
