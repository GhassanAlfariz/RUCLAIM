import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadExcel } from '../api/excel'
import Badge from '../components/Badge'

const TARGET_COLUMNS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]

// ── Tabel hasil ekstraksi ────────────────────────────────────
function ResultTable({ result }) {
  const matched  = result.matched  ?? []   // [{ column_name, mapped_to }]
  const missing  = result.missing  ?? []   // ["Claim Insured", ...]
  const rows     = result.rows     ?? []   // [{ target_name: value, ... }]
  const colHeaders = result.col_headers ?? {} // { target_name: excel_col_name }

  const matchedTargets = new Set(matched.map(m => m.mapped_to))
  const missingTargets = new Set(missing)

  const missingNames = missing.join(', ')

  return (
    <div className="space-y-4">

      {/* ── Ringkasan atas ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              Session #{result.upload_id} &nbsp;·&nbsp; 1 file
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {result.status === 'success' ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Lengkap
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Tidak Lengkap
                </span>
              )}
              <span className="text-sm font-medium text-slate-700">
                {matched.length}/10 kolom ditemukan
              </span>
              {missingTargets.size > 0 && (
                <span className="text-xs text-red-500">
                  Tidak ada: <span className="font-medium">{missingNames}</span>
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-slate-400 truncate max-w-xs" title={result.original_name}>
            {result.original_name}
          </span>
        </div>
      </div>

      {/* ── Tabel data ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              {/* Baris 1: nama kolom target + status */}
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-slate-800 z-10 min-w-[160px]">
                  #&nbsp;&nbsp; File
                </th>
                {TARGET_COLUMNS.map(col => {
                  const isMatched = matchedTargets.has(col)
                  const isMissing = missingTargets.has(col)
                  return (
                    <th
                      key={col}
                      className={`px-3 py-2.5 font-medium text-center whitespace-nowrap min-w-[120px]
                        ${isMissing ? 'text-red-300' : 'text-white'}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {isMatched ? (
                          <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>{col.toUpperCase()}</span>
                      </div>
                      {/* Nama header asli di Excel */}
                      {isMatched && colHeaders[col] && colHeaders[col] !== col && (
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          ← {colHeaders[col]}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={TARGET_COLUMNS.length + 1} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data baris di file ini.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-100 hover:bg-blue-50/40 transition-colors
                      ${i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                  >
                    {/* Kolom file + nomor baris */}
                    <td className="px-3 py-2 sticky left-0 z-10 bg-inherit">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-mono w-5 text-right flex-shrink-0">{i + 1}</span>
                        <span
                          className="text-slate-500 truncate max-w-[120px] text-[11px]"
                          title={result.original_name}
                        >
                          {result.original_name.length > 16
                            ? result.original_name.slice(0, 16) + '...'
                            : result.original_name}
                        </span>
                      </div>
                    </td>

                    {/* Nilai per kolom target */}
                    {TARGET_COLUMNS.map(col => {
                      const isMatched = matchedTargets.has(col)
                      const val = row[col]
                      return (
                        <td key={col} className="px-3 py-2 text-center">
                          {!isMatched ? (
                            <span className="text-slate-300">—</span>
                          ) : val === '' || val === undefined ? (
                            <span className="text-amber-400 text-[11px] italic">kosong</span>
                          ) : (
                            <span
                              className="text-slate-700 block truncate max-w-[150px] mx-auto"
                              title={val}
                            >
                              {val}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer tabel */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>{rows.length} baris data</span>
            <span className="flex items-center gap-1 text-amber-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Kolom ada tapi data kosong
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-300 font-bold">—</span>
              Tidak ditemukan
            </span>
          </div>
          <span className="font-medium text-slate-600">
            {matched.length} dari 10 kolom target ditemukan
          </span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════
export default function UploadPage() {
  const navigate = useNavigate()

  const [file, setFile]         = useState(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFile(accepted[0])
      setResult(null)
      setError(null)
      setProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setProgress(0)
    try {
      const data = await uploadExcel(file, setProgress)
      setResult(data)
    } catch (err) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Terjadi kesalahan.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setProgress(0)
  }

  return (
    <div className="max-w-full space-y-5 px-2">

      {/* Judul */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Upload Excel</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Upload file Excel — sistem deteksi dan tampilkan isi 10 kolom target.
          </p>
        </div>
        {result && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
              border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            ↩ Upload Baru
          </button>
        )}
      </div>

      {/* Info 10 kolom target */}
      {!result && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">10 Kolom Target yang Dideteksi:</p>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_COLUMNS.map(col => (
              <Badge key={col} variant="matched">{col}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dropzone */}
      {!result && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
              ${isDragActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <svg className={`w-7 h-7 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Lepas file di sini...</p>
            ) : (
              <>
                <p className="text-slate-700 font-medium">Drag & drop file Excel ke sini</p>
                <p className="text-slate-400 text-sm">atau klik untuk memilih file</p>
                <p className="text-slate-300 text-xs">.xlsx / .xls</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* File dipilih */}
      {file && !result && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button onClick={handleReset} className="text-slate-400 hover:text-red-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Mengupload & memproses...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700">Gagal memproses file</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Tombol proses */}
      {file && !result && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
            text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {loading ? 'Memproses...' : 'Proses File Excel'}
        </button>
      )}

      {/* Hasil ekstraksi */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-base">Hasil Ekstraksi</h2>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-blue-600 hover:underline"
            >
              Lihat semua riwayat →
            </button>
          </div>
          <ResultTable result={result} />
        </div>
      )}
    </div>
  )
}
