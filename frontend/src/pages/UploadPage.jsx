import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadMultipleExcel } from '../api/excel'
import Badge from '../components/Badge'

const TARGET_COLUMNS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]
const MAX_FILES = 10

// ── Tabel hasil satu file ────────────────────────────────────
function ResultTable({ result }) {
  const matched    = result.matched     ?? []
  const missing    = result.missing     ?? []
  const rows       = result.rows        ?? []
  const colHeaders = result.col_headers ?? {}

  const matchedTargets = new Set(matched.map(m => m.mapped_to))
  const missingTargets = new Set(missing)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Ringkasan file */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {result.status === 'success' ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Lengkap
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Tidak Lengkap
            </span>
          )}
          <span className="text-xs font-medium text-slate-700">{matched.length}/10 kolom</span>
          {missingTargets.size > 0 && (
            <span className="text-xs text-red-500">
              Tidak ada: <span className="font-medium">{[...missingTargets].join(', ')}</span>
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 truncate max-w-[200px]" title={result.original_name}>
          #{result.upload_id} · {result.sheet_name}
        </span>
      </div>

      {/* Tabel data */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-slate-800 z-10 min-w-[150px]">
                # &nbsp; File
              </th>
              {TARGET_COLUMNS.map(col => {
                const isMatched = matchedTargets.has(col)
                const isMissing = missingTargets.has(col)
                return (
                  <th key={col}
                    className={`px-3 py-2 font-medium text-center whitespace-nowrap min-w-[110px]
                      ${isMissing ? 'text-red-300' : 'text-white'}`}>
                    <div className="flex items-center justify-center gap-1">
                      {isMatched ? (
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span>{col.toUpperCase()}</span>
                    </div>
                    {isMatched && colHeaders[col] && colHeaders[col] !== col && (
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">← {colHeaders[col]}</div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={TARGET_COLUMNS.length + 1} className="px-4 py-6 text-center text-slate-400">
                  Tidak ada data baris.
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={i} className={`border-t border-slate-100 hover:bg-blue-50/30
                ${i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                <td className="px-3 py-1.5 sticky left-0 z-10 bg-inherit">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 font-mono w-4 text-right flex-shrink-0">{i + 1}</span>
                    <span className="text-slate-500 truncate max-w-[110px] text-[11px]" title={result.original_name}>
                      {result.original_name.length > 14
                        ? result.original_name.slice(0, 14) + '...'
                        : result.original_name}
                    </span>
                  </div>
                </td>
                {TARGET_COLUMNS.map(col => {
                  const isMatched = matchedTargets.has(col)
                  const val = row[col]
                  return (
                    <td key={col} className="px-3 py-1.5 text-center">
                      {!isMatched ? (
                        <span className="text-slate-300">—</span>
                      ) : !val ? (
                        <span className="text-amber-400 text-[11px] italic">kosong</span>
                      ) : (
                        <span className="text-slate-700 block truncate max-w-[140px] mx-auto" title={val}>
                          {val}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
        <span>
          {result.total_rows > result.preview_rows
            ? `Menampilkan ${rows.length} dari ${result.total_rows} baris`
            : `${rows.length} baris data`}
        </span>
        <span className="font-medium text-slate-600">{matched.length} dari 10 kolom ditemukan</span>
      </div>
    </div>
  )
}

// ── Status badge per file di list ────────────────────────────
function FileStatusIcon({ state }) {
  if (state === 'waiting')
    return <span className="w-5 h-5 rounded-full bg-slate-200 flex-shrink-0" />
  if (state === 'uploading')
    return (
      <svg className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    )
  if (state === 'success')
    return (
      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  if (state === 'error')
    return (
      <svg className="w-5 h-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    )
  return null
}

// ════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════
export default function UploadPage() {
  const navigate = useNavigate()

  // files: File[]
  const [files, setFiles]     = useState([])
  // fileStates: { state: 'waiting'|'uploading'|'success'|'error', progress: number, result, message }[]
  const [fileStates, setFileStates] = useState([])
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  const updateFileState = (idx, patch) =>
    setFileStates(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))

  const onDrop = useCallback((accepted) => {
    const remaining = MAX_FILES - files.length
    const toAdd = accepted.slice(0, remaining)
    if (toAdd.length === 0) return
    setFiles(prev => [...prev, ...toAdd])
    setFileStates(prev => [
      ...prev,
      ...toAdd.map(() => ({ state: 'waiting', progress: 0, result: null, message: '' }))
    ])
    setDone(false)
  }, [files])

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setFileStates(prev => prev.filter((_, i) => i !== idx))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: MAX_FILES,
    disabled: loading || files.length >= MAX_FILES,
  })

  const handleUpload = async () => {
    if (files.length === 0 || loading) return
    setLoading(true)
    setDone(false)

    await uploadMultipleExcel(
      files,
      (idx, pct) => updateFileState(idx, { state: 'uploading', progress: pct }),
      (idx, res) => {
        if (res.status === 'success') {
          updateFileState(idx, { state: 'success', progress: 100, result: res.data })
        } else {
          updateFileState(idx, { state: 'error', progress: 0, message: res.message })
        }
      }
    )

    setLoading(false)
    setDone(true)
  }

  const handleReset = () => {
    setFiles([])
    setFileStates([])
    setDone(false)
  }

  const successCount = fileStates.filter(s => s.state === 'success').length
  const errorCount   = fileStates.filter(s => s.state === 'error').length

  return (
    <div className="max-w-full space-y-5 px-2">

      {/* Judul */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Upload Excel</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Upload hingga {MAX_FILES} file Excel sekaligus — deteksi 10 kolom target otomatis.
          </p>
        </div>
        {done && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ↩ Upload Baru
            </button>
            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Lihat Riwayat
            </button>
          </div>
        )}
      </div>

      {/* Info kolom target */}
      {!done && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">10 Kolom Target yang Dideteksi:</p>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_COLUMNS.map(col => (
              <Badge key={col} variant="matched">{col}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dropzone — sembunyikan kalau sudah done atau penuh */}
      {!done && files.length < MAX_FILES && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center
              ${isDragActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <svg className={`w-6 h-6 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-blue-600 font-medium text-sm">Lepas file di sini...</p>
            ) : (
              <>
                <p className="text-slate-700 font-medium text-sm">Drag & drop file Excel ke sini</p>
                <p className="text-slate-400 text-xs">atau klik untuk memilih · maks {MAX_FILES} file (.xlsx / .xls)</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* List file yang dipilih */}
      {files.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">
              {files.length} file dipilih
              {files.length >= MAX_FILES && (
                <span className="ml-2 text-xs text-amber-500">(maksimum tercapai)</span>
              )}
            </span>
            {!loading && !done && (
              <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                Hapus semua
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {files.map((f, idx) => {
              const st = fileStates[idx]
              return (
                <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                  <FileStatusIcon state={st?.state ?? 'waiting'} />

                  {/* Info file */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate font-medium">{f.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</span>
                      {st?.state === 'uploading' && (
                        <span className="text-xs text-blue-500">{st.progress}%</span>
                      )}
                      {st?.state === 'error' && (
                        <span className="text-xs text-red-500">{st.message}</span>
                      )}
                      {st?.state === 'success' && st.result && (
                        <span className="text-xs text-emerald-600">
                          {st.result.matched?.length ?? 0}/10 kolom · {st.result.rows?.length ?? 0} baris
                        </span>
                      )}
                    </div>

                    {/* Progress bar saat uploading */}
                    {st?.state === 'uploading' && (
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-1 rounded-full transition-all duration-200"
                          style={{ width: `${st.progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Tombol hapus — hanya saat belum upload */}
                  {!loading && !done && (
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tombol proses */}
      {files.length > 0 && !done && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
            text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {loading
            ? `Memproses... (${fileStates.filter(s => s.state === 'success' || s.state === 'error').length}/${files.length})`
            : `Proses ${files.length} File Excel`}
        </button>
      )}

      {/* Ringkasan setelah selesai */}
      {done && (successCount > 0 || errorCount > 0) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm
          ${errorCount === 0
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <span className="font-semibold">{successCount} file</span> berhasil diproses
            {errorCount > 0 && <span className="ml-1 text-red-600">· {errorCount} gagal</span>}
          </span>
        </div>
      )}

      {/* Hasil per file */}
      {done && (
        <div className="space-y-6">
          <h2 className="font-bold text-slate-800 text-base">Hasil Ekstraksi</h2>
          {fileStates.map((st, idx) => (
            <div key={idx}>
              {st.state === 'success' && st.result && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 px-1 truncate" title={files[idx].name}>
                    {idx + 1}. {files[idx].name}
                  </p>
                  <ResultTable result={st.result} />
                </div>
              )}
              {st.state === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  <span className="font-medium">{files[idx].name}</span> — {st.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
