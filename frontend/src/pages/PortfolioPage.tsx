import { useGetMyPortfoliosQuery, usePlaceTradeMutation } from '@/store/api/gameApi'
import { useNavigate } from 'react-router-dom'

export default function PortfolioPage() {
  const { data: portfolios, isLoading } = useGetMyPortfoliosQuery()
  const [placeTrade] = usePlaceTradeMutation()
  const navigate = useNavigate()

  const handleSell = async (portfolioId: number, holding: any) => {
    if (!confirm(`Sell ${holding.quantity} contracts of ${holding.optionSymbol}?`)) return

    try {
      await placeTrade({
        competitionId: portfolios?.find((p) => p.id === portfolioId)?.competition_id.toString()!,
        trade: {
          symbol: holding.symbol,
          optionSymbol: holding.optionSymbol,
          type: 'SELL',
          side: holding.side,
          quantity: holding.quantity,
        },
      }).unwrap()
      alert('Sold successfully!')
    } catch (err: any) {
      alert(`Failed to sell: ${err.data?.error || err.message}`)
    }
  }

  if (isLoading) return <div className="p-8">Loading portfolios...</div>

  return (
    <div className="min-h-screen p-8 text-white">
      <h1 className="text-3xl font-bold mb-4">My Portfolios</h1>
      <p className="text-gray-400 mb-8">View your performance across all active competitions.</p>

      {!portfolios || portfolios.length === 0 ? (
        <div className="p-6 bg-gray-800 rounded-lg">
          <p className="text-gray-400 mb-4">You haven't joined any competitions yet.</p>
          <button
            onClick={() => navigate('/competitions')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Browse Competitions
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {portfolios.map((portfolio) => (
            <div key={portfolio.id} className="p-6 bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-1">{portfolio.competition_name}</h3>
                  <div className="text-sm text-gray-400">
                    Cash Balance:{' '}
                    <span className="text-green-400 font-mono text-lg">
                      ${portfolio.cash_balance.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/trade?competitionId=${portfolio.competition_id}`)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
                >
                  Trade
                </button>
              </div>

              {/* Holdings Table */}
              <h4 className="text-lg font-semibold mb-4 text-gray-300">Current Holdings</h4>
              {!portfolio.holdings || portfolio.holdings.length === 0 ? (
                <p className="text-gray-500 italic">No active positions.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-sm text-gray-400 border-b border-gray-700">
                        <th className="py-2">Symbol</th>
                        <th className="py-2">Side</th>
                        <th className="py-2">Contract</th>
                        <th className="py-2 text-right">Strike</th>
                        <th className="py-2 text-right">Qty</th>
                        <th className="py-2 text-right">Avg Price</th>
                        <th className="py-2 text-right">Total Cost</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.holdings.map((holding) => (
                        <tr key={holding.optionSymbol} className="border-b border-gray-700/50">
                          <td className="py-4 font-bold">{holding.symbol}</td>
                          <td className="py-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                holding.side === 'CALL'
                                  ? 'bg-green-900 text-green-300'
                                  : 'bg-red-900 text-red-300'
                              }`}
                            >
                              {holding.side}
                            </span>
                          </td>
                          <td className="py-4 font-mono text-sm">{holding.optionSymbol}</td>
                          <td className="py-4 text-right font-mono">
                            ${holding.strike.toFixed(2)}
                          </td>
                          <td className="py-4 text-right font-mono">{holding.quantity}</td>
                          <td className="py-4 text-right font-mono">
                            $
                            {(holding.avgPrice * 100).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="py-4 text-right font-mono text-gray-400">
                            $
                            {holding.totalCost.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleSell(portfolio.id, holding)}
                              className="px-3 py-1 bg-gray-700 hover:bg-red-600 hover:text-white rounded text-sm transition-colors"
                            >
                              Sell
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
