import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'

function Navbar() {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150'
  const active = `${base} bg-blue-600 text-white`
  const inactive = `${base} text-slate-600 hover:bg-slate-100`

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-slate-800 text-sm">RU Claim</span>
          <span className="hidden sm:block text-slate-400 text-xs ml-1">Excel Column Extractor</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <NavLink to="/"
            className={({ isActive }) => isActive ? active : inactive}
            end
          >
            Upload
          </NavLink>
          <NavLink to="/history"
            className={({ isActive }) => isActive ? active : inactive}
          >
            Riwayat
          </NavLink>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/"               element={<UploadPage />} />
            <Route path="/history"        element={<HistoryPage />} />
            <Route path="/history/:id"    element={<HistoryDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
