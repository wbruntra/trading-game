import { useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { logout } from '@/store/slices/authSlice'

export default function DashboardPage() {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  if (!isAuthenticated || !user) {
    navigate('/login')
    return null
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-2xl font-bold">
          Welcome, <span className="text-blue-400">{user.username}</span>
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Competitions</h2>
          <p className="text-gray-400 mb-4">Join or create a trading competition</p>
          <button
            onClick={() => navigate('/competitions')}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            View Competitions
          </button>
        </div>

        <div className="p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Portfolio</h2>
          <p className="text-gray-400 mb-4">View your holdings and P&L</p>
          <button
            onClick={() => navigate('/portfolio')}
            className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            View Portfolio
          </button>
        </div>
      </main>
    </div>
  )
}
