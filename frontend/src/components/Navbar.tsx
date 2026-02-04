import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logout } from '@/store/slices/authSlice'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-green-400">
              Options Game
            </Link>
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                to="/competitions"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/competitions')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Competitions
              </Link>
              <Link
                to="/portfolio"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/portfolio')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Portfolio
              </Link>
              <Link
                to="/trade"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/trade')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Trade
              </Link>
            </div>
          </div>
          <div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
