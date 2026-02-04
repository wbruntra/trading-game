import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import Navbar from '@/components/Navbar'

import CompetitionsPage from '@/pages/CompetitionsPage'
import TradingPage from '@/pages/TradingPage'
import PortfolioPage from '@/pages/PortfolioPage'

function App() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      {!['/login', '/register'].includes(location.pathname) && <Navbar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/trade" element={<TradingPage />} />
      </Routes>
    </div>
  )
}

export default App
