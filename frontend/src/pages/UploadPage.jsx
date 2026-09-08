import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadExcel } from '../api/excel'
import ColumnGroupCard from '../components/ColumnGroupCard'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

// Kolom target yang wajib ada (untuk referensi tampilan)
const TARGET_COLUMNS = [
  'Police No', 'Certif', 'Claim Insured', 'Start Date',
  'End Date', 'MOC', 'FACCODE', 'COB', 'Insured', 'Cedant',
]

export default function UploadPage() {
  const navigate = useNavigate()

  const [file, setFile]           = useState(null)
  const [progress, setProgress]   = useState(0)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)   // hasil dari API
  const [error, setError]         = useState(null)

  // ---- Dropzone ----
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

  // ---- Upload ----
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

  // ---- Transformasi data untuk ColumnGroupCard ----
  const matchedItems = result?.matched?.map(m => ({
    label: m.column_name,
    sublabel: m.mapped_to !== m.column_name ? m.mapped_to : null,
  })) ?? []

  const missingItems = result?.missing?.map(m => ({
    label: m,
    sublabel: null,
  })) ?? []

  const irrelevantItems = result?.irrelevant?.map(col => ({
    label: col,
    sublabel: null,
  })) ?? []

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ---- Judul ---- */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload Excel</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload file Excel (.xlsx / .xls) untuk mendeteksi kolom-kolom target secara otomatis.
        </p>
      </div>

      {/* ---- Info kolom target ---- */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2">10 Kolom Target yang Dideteksi:</p>
        <div className="flex flex-wrap gap-1.5">
          {TARGET_COLUMNS.map(col => (
            <Badge key={col} variant="matched">{col}</Badge>
          ))}
        </div>
      </div>

      {/* ---- Dropzone ---- */}
      {!result && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors duration-150
            ${isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'
            }`}
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
                <p className="text-slate-700 font-medium">
                  Drag & drop file Excel ke sini
                </p>
                <p className="text-slate-400 text-sm">atau klik untuk memilih file</p>
                <p className="text-slate-300 text-xs">.xlsx / .xls</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- File dipilih ---- */}
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
          <button onClick={handleReset}
            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ---- Progress bar ---- */}
      {loading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Mengupload & memproses...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ---- Error ---- */}
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

      {/* ---- Tombol Upload ---- */}
      {file && !result && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
            text-white font-semibold rounded-xl transition-colors duration-150 text-sm"
        >
          {loading ? 'Memproses...' : 'Proses File Excel'}
        </button>
      )}

      {/* ================================================================
          HASIL DETEKSI
          ================================================================ */}
      {result && (
        <div className="space-y-5">

          {/* Header hasil */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={result.status}>{result.status.toUpperCase()}</Badge>
                  <p className="font-semibold text-slate-800 text-sm">{result.original_name}</p>
                </div>
                <p className="text-xs text-slate-500">
                  Sheet: <span className="font-medium text-slate-700">{result.sheet_name}</span>
                  {' · '}
                  Total kolom: <span className="font-medium text-slate-700">{result.total_columns}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Upload Lagi
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Lihat Riwayat
                </button>
              </div>
            </div>

            {/* Stat summary */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <StatCard label="Kolom Diambil" value={result.matched?.length ?? 0} color="green" />
              <StatCard label="Kolom Tidak Ditemukan" value={result.missing?.length ?? 0} color="red" />
              <StatCard label="Kolom Tidak Relevan" value={result.irrelevant?.length ?? 0} color="slate" />
            </div>
          </div>

          {/* 3 Group cards */}
          <ColumnGroupCard
            title="Kolom Target Berhasil Diambil"
            subtitle="Kolom yang ditemukan dan berhasil dipetakan ke target"
            color="green"
            icon="✅"
            items={matchedItems}
            emptyMessage="Tidak ada kolom target yang ditemukan."
          />

          <ColumnGroupCard
            title="Kolom Target Tidak Ditemukan"
            subtitle="Kolom yang seharusnya ada tapi tidak terdeteksi di file ini"
            color="red"
            icon="❌"
            items={missingItems}
            emptyMessage="Semua kolom target berhasil ditemukan. 🎉"
          />

          <ColumnGroupCard
            title="Kolom Tidak Relevan"
            subtitle="Kolom yang ada di file tapi bukan merupakan kolom target"
            color="slate"
            icon="📋"
            items={irrelevantItems}
            emptyMessage="Tidak ada kolom di luar target."
          />

          {/* Navigasi ke riwayat */}
          <div className="text-center pb-4">
            <button
              onClick={() => navigate(`/history/${result.upload_id}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              Lihat detail riwayat upload ini →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
