import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { useEffect } from 'react'

export default function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useSelector((state: RootState) => state.auth)
  const { activeCompetitionId } = useSelector((state: RootState) => state.game)

  useEffect(() => {
    if (isAuthenticated) {
      if (activeCompetitionId) {
        navigate('/portfolio', { replace: true })
      } else {
        navigate('/competitions', { replace: true })
      }
    }
  }, [isAuthenticated, activeCompetitionId, navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-white">
      <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent text-center">
        Options Trading Game
      </h1>
      <p className="text-xl text-gray-400 mb-12 max-w-md text-center">
        Compete with friends to see who can make the most money trading options!
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Login
        </button>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
        >
          Register
        </button>
      </div>
    </div>
  )
}
