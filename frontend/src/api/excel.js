import api from './client'

/**
 * Upload file Excel ke backend.
 * @param {File} file
 * @param {function} onProgress - callback (percent: number)
 */
export async function uploadExcel(file, onProgress) {
  const form = new FormData()
  form.append('file', file)

  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5 menit — file besar butuh waktu lebih lama
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
  return data
}

/**
 * Upload banyak file Excel sekaligus (satu per satu ke backend).
 * @param {File[]} files
 * @param {function} onFileProgress - callback (fileIndex, percent)
 * @param {function} onFileDone    - callback (fileIndex, result|error)
 */
export async function uploadMultipleExcel(files, onFileProgress, onFileDone) {
  const results = []
  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadExcel(files[i], (pct) => onFileProgress?.(i, pct))
      onFileDone?.(i, { status: 'success', data: result })
      results.push({ status: 'success', data: result })
    } catch (err) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Gagal'
      onFileDone?.(i, { status: 'error', message: msg })
      results.push({ status: 'error', message: msg })
    }
  }
  return results
}

/**
 * Ambil daftar semua riwayat upload (ringkasan).
 */
export async function fetchHistory() {
  const { data } = await api.get('/history')
  return data
}

/**
 * Ambil detail satu riwayat upload.
 * @param {number} id
 */
export async function fetchHistoryDetail(id) {
  const { data } = await api.get(`/history/${id}`)
  return data
}

/**
 * Hapus satu riwayat upload.
 * @param {number} id
 */
export async function deleteHistory(id) {
  const { data } = await api.delete(`/history/${id}`)
  return data
}

/**
 * Ambil preview isi data kolom target dari file Excel.
 * @param {number} id
 * @returns {{ [targetName]: { column_name: string, values: string[] } }}
 */
export async function fetchColumnPreview(id) {
  const { data } = await api.get(`/history/${id}/preview`)
  return data
}
