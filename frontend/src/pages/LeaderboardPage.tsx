import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGetLeaderboardQuery } from '@/store/api/gameApi'
import { format } from 'date-fns'

export default function LeaderboardPage() {
  const { competitionId } = useParams<{ competitionId: string }>()
  const [shouldRefresh, setShouldRefresh] = useState(false)

  const {
    data: leaderboard,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetLeaderboardQuery(
    { competitionId: competitionId!, refresh: shouldRefresh },
    { skip: !competitionId },
  )

  const handleRefresh = async () => {
    setShouldRefresh(true)
    await refetch()
    setShouldRefresh(false)
  }

  if (isLoading) return <div className="p-8 text-white">Loading leaderboard...</div>
  if (error) return <div className="p-8 text-red-400">Error loading leaderboard</div>

  return (
    <div className="min-h-screen p-8 bg-gray-900 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-gray-400">Competition ID: {competitionId}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          {isFetching ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Refreshing...
            </>
          ) : (
            'Refresh Live Standings'
          )}
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-700/50 text-sm text-gray-400 uppercase tracking-wider">
              <th className="py-4 px-6">Rank</th>
              <th className="py-4 px-6">User</th>
              <th className="py-4 px-6 text-right">Portfolio Value</th>
              <th className="py-4 px-6 text-right">Cash Balance</th>
              <th className="py-4 px-6 text-right">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {leaderboard?.map((entry, index) => (
              <tr key={entry.id} className="hover:bg-gray-700/30 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50'
                          : index === 1
                          ? 'bg-gray-300/20 text-gray-300 border border-gray-300/50'
                          : index === 2
                          ? 'bg-orange-600/20 text-orange-600 border border-orange-600/50'
                          : 'text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="font-semibold text-lg">{entry.username}</span>
                </td>
                <td className="py-4 px-6 text-right">
                  <span className="font-mono text-xl font-bold text-green-400">
                    $
                    {Number(entry.total_value).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </td>
                <td className="py-4 px-6 text-right text-gray-400 font-mono">
                  $
                  {Number(entry.cash_balance).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="py-4 px-6 text-right text-sm text-gray-500">
                  {entry.last_updated_at
                    ? format(new Date(entry.last_updated_at), 'MMM d, HH:mm:ss')
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!leaderboard || leaderboard.length === 0) && (
          <div className="p-12 text-center text-gray-500 italic">No participants yet.</div>
        )}
      </div>
    </div>
  )
}
