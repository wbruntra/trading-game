import { useState } from 'react'
import { useGetPortfolioByCompetitionQuery, usePlaceTradeMutation } from '@/store/api/gameApi'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export default function PortfolioPage() {
  const { activeCompetitionId } = useSelector((state: RootState) => state.game)
  const { data: portfolio, isLoading } = useGetPortfolioByCompetitionQuery(activeCompetitionId!, {
    skip: !activeCompetitionId,
  })
  const [placeTrade] = usePlaceTradeMutation()
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<any>(null)

  const handleSellClick = (holding: any) => {
    setSelectedHolding(holding)
    setModalOpen(true)
  }

  const handleConfirmSell = async () => {
    if (!selectedHolding || !portfolio || !activeCompetitionId) return

    try {
      await placeTrade({
        competitionId: activeCompetitionId,
        trade: {
          symbol: selectedHolding.symbol,
          optionSymbol: selectedHolding.optionSymbol,
          type: 'SELL',
          side: selectedHolding.side,
          quantity: selectedHolding.quantity,
        },
      }).unwrap()
      toast.success('Sold successfully!')
    } catch (err: any) {
      toast.error(`Failed to sell: ${err.data?.error || err.message}`)
    }
  }

  if (isLoading) return <div className="p-4 sm:p-8">Loading portfolio...</div>

  if (!portfolio) {
    return (
      <div className="min-h-screen p-4 sm:p-8 text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">Portfolio</h1>
        <div className="p-6 bg-gray-800 rounded-lg">
          <p className="text-gray-400 mb-4">You haven't joined this competition yet.</p>
          <button
            onClick={() => navigate('/competitions')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Browse Competitions
          </button>
        </div>
      </div>
    )
  }

  const holdingsValue =
    portfolio.holdings?.reduce((sum, h) => sum + (h.lastPrice || 0) * h.quantity * 100, 0) || 0
  const totalMarketValue = portfolio.cash_balance + holdingsValue
  const totalPL =
    portfolio.holdings?.reduce(
      (sum, h) => sum + (h.lastPrice || 0) * h.quantity * 100 - h.totalCost,
      0,
    ) || 0

  return (
    <div className="min-h-screen p-4 sm:p-8 text-white">
      <ConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmSell}
        title="Confirm Sell"
        message={`Are you sure you want to sell ${selectedHolding?.quantity} contracts of ${selectedHolding?.symbol} ${selectedHolding?.side}?`}
        confirmText="Sell"
      />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{portfolio.competition_name}</h1>
          <p className="text-gray-400 text-sm">Your portfolio for this competition</p>
        </div>
        <button
          onClick={() => navigate('/trade')}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
        >
          Trade
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Cash Balance</div>
          <div className="text-2xl font-bold font-mono text-green-400">
            ${portfolio.cash_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Holdings Value</div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            ${holdingsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Total Market Value</div>
          <div className="text-2xl font-bold font-mono">
            ${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Total P/L</div>
          <div
            className={`text-2xl font-bold font-mono ${
              totalPL >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {totalPL >= 0 ? '+' : ''}$
            {totalPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Current Holdings</h2>
        {!portfolio.holdings || portfolio.holdings.length === 0 ? (
          <p className="text-gray-500 italic">No active positions. Start trading!</p>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
              {portfolio.holdings.map((holding) => {
                const marketValue = (holding.lastPrice || 0) * holding.quantity * 100
                const pl = marketValue - holding.totalCost
                const plPct = holding.totalCost > 0 ? (pl / holding.totalCost) * 100 : 0

                return (
                  <div
                    key={holding.optionSymbol}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">{holding.symbol}</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            holding.side === 'CALL'
                              ? 'bg-green-900 text-green-300'
                              : 'bg-red-900 text-red-300'
                          }`}
                        >
                          {holding.side}
                        </span>
                      </div>
                      <button
                        onClick={() => handleSellClick(holding)}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-sm font-semibold text-red-400 border border-red-600/50 transition-colors"
                      >
                        Sell
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Quantity</div>
                        <div className="font-mono font-semibold">{holding.quantity}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Avg Price</div>
                        <div className="font-mono font-semibold">
                          $
                          {(holding.avgPrice * 100).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Current Price</div>
                        <div className="font-mono font-semibold">
                          {holding.lastPrice ? (
                            `$${(holding.lastPrice * 100).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}`
                          ) : (
                            <span className="text-gray-600">---</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Market Value</div>
                        <div className="font-mono font-semibold">
                          ${marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* P/L Section */}
                    <div className="pt-3 border-t border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Total P/L</span>
                        <div
                          className={`font-mono font-bold ${
                            pl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          <span className="text-lg">
                            {pl >= 0 ? '+' : ''}$
                            {Math.abs(pl).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                          <span className="text-sm ml-2 opacity-80">
                            ({pl >= 0 ? '+' : ''}
                            {plPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-sm text-gray-400 border-b border-gray-700">
                    <th className="py-3">Symbol</th>
                    <th className="py-3">Side</th>
                    <th className="py-3 text-right">Qty</th>
                    <th className="py-3 text-right">Avg Price</th>
                    <th className="py-3 text-right">Current</th>
                    <th className="py-3 text-right">Value</th>
                    <th className="py-3 text-right">P/L</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.map((holding) => {
                    const marketValue = (holding.lastPrice || 0) * holding.quantity * 100
                    const pl = marketValue - holding.totalCost
                    const plPct = holding.totalCost > 0 ? (pl / holding.totalCost) * 100 : 0

                    return (
                      <tr
                        key={holding.optionSymbol}
                        className="border-b border-gray-700/50 hover:bg-gray-700/20"
                      >
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
                        <td className="py-4 text-right font-mono">{holding.quantity}</td>
                        <td className="py-4 text-right font-mono">
                          $
                          {(holding.avgPrice * 100).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-4 text-right font-mono">
                          {holding.lastPrice ? (
                            `$${(holding.lastPrice * 100).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}`
                          ) : (
                            <span className="text-gray-600">---</span>
                          )}
                        </td>
                        <td className="py-4 text-right font-mono">
                          ${marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td
                          className={`py-4 text-right font-mono font-semibold ${
                            pl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          <div>
                            {pl >= 0 ? '+' : ''}$
                            {Math.abs(pl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs opacity-80">
                            ({pl >= 0 ? '+' : ''}
                            {plPct.toFixed(1)}%)
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleSellClick(holding)}
                            className="px-3 py-1 bg-gray-700 hover:bg-red-600 hover:text-white rounded text-sm transition-colors"
                          >
                            Sell
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
