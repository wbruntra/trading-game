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
import PublicPortfolioPage from '@/pages/PublicPortfolioPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import AuthInitializer from '@/components/AuthInitializer'
import ProtectedRoute from '@/components/ProtectedRoute'
import PublicRoute from '@/components/PublicRoute'
import RequiresCompetition from '@/components/RequiresCompetition'

function App() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      <AuthInitializer>
        {!['/login', '/register'].includes(location.pathname) && <Navbar />}
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Public Routes (Guest Only) */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Protected Routes (Authenticated Only) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/leaderboard/:competitionId" element={<LeaderboardPage />} />
            <Route
              path="/leaderboard/:competitionId/portfolio/:portfolioId"
              element={<PublicPortfolioPage />}
            />

            {/* Routes requiring active competition */}
            <Route element={<RequiresCompetition />}>
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/trade" element={<TradingPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthInitializer>
    </div>
  )
}

export default App
