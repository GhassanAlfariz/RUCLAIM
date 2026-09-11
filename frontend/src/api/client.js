import axios from 'axios'

const api = axios.create({
  baseURL: '/api',   // di-proxy oleh Vite ke http://localhost:8000
  timeout: 120000,   // 2 menit
})

export default api
