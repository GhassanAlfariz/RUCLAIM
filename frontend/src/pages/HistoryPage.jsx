import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchHistory, deleteHistory } from '../api/excel'
import Badge from '../components/Badge'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

function StatusBar({ matched, missing, total }) {
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap">{pct}%</span>
    </div>
  )
}

export default function HistoryPage() {
  const navigate = useNavigate()

  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting] = useState(null)  // id yang sedang dihapus

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory()
      setList(data)
    } catch (e) {
      setError('Gagal memuat riwayat. Pastikan backend berjalan.')
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
    } catch {
      alert('Gagal menghapus. Coba lagi.')
    } finally {
      setDeleting(null)
    }
  }

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  // ---- Error ----
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={loadHistory}
            className="mt-3 text-sm text-blue-600 hover:underline">
            Coba lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ---- Judul ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Riwayat Upload</h1>
          <p className="text-slate-500 text-sm mt-1">
            {list.length} file pernah diupload
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Baru
        </button>
      </div>

      {/* ---- Empty state ---- */}
      {list.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">Belum ada riwayat upload</p>
          <p className="text-slate-400 text-sm mt-1">Upload file Excel pertama kamu.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Sekarang
          </button>
        </div>
      )}

      {/* ---- List riwayat ---- */}
      <div className="space-y-3">
        {list.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/history/${item.id}`)}
            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer
              hover:border-blue-300 hover:shadow-sm transition-all duration-150 group"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Kiri: info file */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Icon file */}
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  {/* Nama file + badge status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 text-sm truncate max-w-xs">
                      {item.original_name}
                    </p>
                    <Badge variant={item.status}>
                      {item.status === 'success' ? 'Lengkap'
                        : item.status === 'partial' ? 'Parsial'
                        : 'Gagal'}
                    </Badge>
                  </div>

                  {/* Meta */}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(new Date(item.uploaded_at), "d MMM yyyy, HH:mm", { locale: localeId })}
                    {item.sheet_name && ` · Sheet: ${item.sheet_name}`}
                    {` · ${item.total_columns} kolom`}
                  </p>

                  {/* Progress bar matched */}
                  <div className="mt-2">
                    <StatusBar
                      matched={item.matched_count}
                      missing={item.missing_count}
                      total={item.matched_count + item.missing_count}
                    />
                  </div>

                  {/* Angka 3 kategori */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {item.matched_count} diambil
                    </span>
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                      {item.missing_count} tidak ditemukan
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                      {item.irrelevant_count} tidak relevan
                    </span>
                  </div>
                </div>
              </div>

              {/* Kanan: tombol hapus + arrow */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  disabled={deleting === item.id}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50
                    rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Hapus"
                >
                  {deleting === item.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
