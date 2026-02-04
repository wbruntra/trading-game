import { useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  useGetCompetitionsQuery,
  useGetMyPortfoliosQuery,
  useCreateCompetitionMutation,
  useJoinCompetitionMutation,
} from '@/store/api/gameApi'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setActiveCompetition } from '@/store/slices/gameSlice'

export default function CompetitionsPage() {
  const { data: competitions, isLoading } = useGetCompetitionsQuery()
  const [createCompetition] = useCreateCompetitionMutation()
  const [joinCompetition] = useJoinCompetitionMutation()
  const { data: myPortfolios } = useGetMyPortfoliosQuery()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [showCreate, setShowCreate] = useState(false)
  const [newCompName, setNewCompName] = useState('')
  const [initialBalance, setInitialBalance] = useState(100000)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createCompetition({
        name: newCompName,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        initialBalance,
      }).unwrap()
      setShowCreate(false)
      setNewCompName('')
      toast.success('Competition created!')
    } catch (err) {
      console.error('Failed to create competition', err)
      toast.error('Failed to create competition')
    }
  }

  const handleJoin = async (id: number) => {
    try {
      await joinCompetition(id.toString()).unwrap()
      dispatch(setActiveCompetition(id.toString()))
      navigate('/portfolio')
    } catch (err) {
      console.error('Failed to join', err)
      toast.error('Failed to join competition')
    }
  }

  const handleSwitch = (id: number) => {
    dispatch(setActiveCompetition(id.toString()))
    navigate('/portfolio')
  }

  if (isLoading) return <div className="p-4 sm:p-8">Loading...</div>

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Competitions</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold w-full sm:w-auto"
        >
          {showCreate ? 'Cancel' : 'Create New'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gray-800 rounded-xl">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Create Competition</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Initial Balance</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600"
              />
            </div>
            <button type="submit" className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg">
              Create
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {competitions?.map((comp) => {
          const isJoined = myPortfolios?.some((p) => p.competition_id === comp.id)
          return (
            <div key={comp.id} className="p-6 bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold">{comp.name}</h2>
                {isJoined && (
                  <span className="bg-green-900 text-green-300 text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wider">
                    Joined
                  </span>
                )}
              </div>
              <p className="text-gray-400 mb-4">
                Balance: ${comp.initial_balance.toLocaleString()}
              </p>
              <div className="flex gap-2">
                {isJoined ? (
                  <button
                    onClick={() => handleSwitch(comp.id)}
                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold"
                  >
                    Portfolio
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoin(comp.id)}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-semibold shadow-lg hover:shadow-purple-500/20"
                  >
                    Join
                  </button>
                )}
                <button
                  onClick={() => navigate(`/leaderboard/${comp.id}`)}
                  className="px-4 py-2 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors text-gray-300 hover:text-white"
                  title="View Leaderboard"
                >
                  🏆
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
