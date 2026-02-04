import { useState } from 'react'
import { useGetMyPortfoliosQuery, usePlaceTradeMutation } from '@/store/api/gameApi'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ConfirmationModal } from '@/components/ConfirmationModal'

export default function PortfolioPage() {
  const { data: portfolios, isLoading } = useGetMyPortfoliosQuery()
  const [placeTrade] = usePlaceTradeMutation()
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<any>(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null)

  const handleSellClick = (portfolioId: number, holding: any) => {
    setSelectedPortfolioId(portfolioId)
    setSelectedHolding(holding)
    setModalOpen(true)
  }

  const handleConfirmSell = async () => {
    if (!selectedHolding || !selectedPortfolioId) return

    try {
      await placeTrade({
        competitionId: portfolios
          ?.find((p) => p.id === selectedPortfolioId)
          ?.competition_id.toString()!,
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

  if (isLoading) return <div className="p-4 sm:p-8">Loading portfolios...</div>

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

      <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">My Portfolios</h1>
      <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
        View your performance across all active competitions.
      </p>

      {!portfolios || portfolios.length === 0 ? (
        <div className="p-4 sm:p-6 bg-gray-800 rounded-lg">
          <p className="text-gray-400 mb-4">You haven't joined any competitions yet.</p>
          <button
            onClick={() => navigate('/competitions')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg w-full sm:w-auto"
          >
            Browse Competitions
          </button>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="p-4 sm:p-6 bg-gray-800 rounded-xl border border-gray-700"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-1">
                    {portfolio.competition_name}
                  </h3>
                  <div className="text-sm text-gray-400">
                    Cash Balance:{' '}
                    <span className="text-green-400 font-mono text-base sm:text-lg">
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

              {/* Portfolio Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-700/30 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Total Market Value</div>
                  <div className="text-2xl font-bold font-mono">
                    $
                    {(
                      portfolio.cash_balance +
                      (portfolio.holdings?.reduce(
                        (sum, h) => sum + (h.lastPrice || 0) * h.quantity * 100,
                        0,
                      ) || 0)
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-gray-700/30 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Holdings Value</div>
                  <div className="text-2xl font-bold font-mono text-blue-400">
                    $
                    {(
                      portfolio.holdings?.reduce(
                        (sum, h) => sum + (h.lastPrice || 0) * h.quantity * 100,
                        0,
                      ) || 0
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-gray-700/30 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Total P/L</div>
                  <div
                    className={`text-2xl font-bold font-mono ${
                      (portfolio.holdings?.reduce(
                        (sum, h) => sum + (h.lastPrice || 0) * h.quantity * 100 - h.totalCost,
                        0,
                      ) || 0) >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    $
                    {(
                      portfolio.holdings?.reduce(
                        (sum, h) => sum + (h.lastPrice || 0) * h.quantity * 100 - h.totalCost,
                        0,
                      ) || 0
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Holdings Table */}
              <h4 className="text-lg font-semibold mb-4 text-gray-300">Current Holdings</h4>
              {!portfolio.holdings || portfolio.holdings.length === 0 ? (
                <p className="text-gray-500 italic">No active positions.</p>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="space-y-3 md:hidden">
                    {portfolio.holdings.map((holding) => {
                      const marketValue = (holding.lastPrice || 0) * holding.quantity * 100
                      const pl = marketValue - holding.totalCost
                      const plPct = (pl / holding.totalCost) * 100

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
                              onClick={() => handleSellClick(portfolio.id, holding)}
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
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-0.5">Current Price</div>
                              <div className="font-mono font-semibold">
                                {holding.lastPrice ? (
                                  `$${(holding.lastPrice * 100).toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                    minimumFractionDigits: 2,
                                  })}`
                                ) : (
                                  <span className="text-gray-600">---</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-0.5">Market Value</div>
                              <div className="font-mono font-semibold">
                                $
                                {marketValue.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
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
                                  {plPct.toFixed(2)}%)
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
                          <th className="py-2">Symbol</th>
                          <th className="py-2">Side</th>
                          <th className="py-2 text-right">Qty</th>
                          <th className="py-2 text-right">Avg Price</th>
                          <th className="py-2 text-right">Current Price</th>
                          <th className="py-2 text-right">Market Value</th>
                          <th className="py-2 text-right">Total P/L</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.holdings.map((holding) => {
                          const marketValue = (holding.lastPrice || 0) * holding.quantity * 100
                          const pl = marketValue - holding.totalCost
                          const plPct = (pl / holding.totalCost) * 100

                          return (
                            <tr
                              key={holding.optionSymbol}
                              className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors"
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
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-4 text-right font-mono">
                                {holding.lastPrice ? (
                                  `$ ${(holding.lastPrice * 100).toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                    minimumFractionDigits: 2,
                                  })}`
                                ) : (
                                  <span className="text-gray-600">---</span>
                                )}
                              </td>
                              <td className="py-4 text-right font-mono">
                                $
                                {marketValue.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                              <td
                                className={`py-4 text-right font-mono font-semibold ${
                                  pl >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                <div>
                                  {pl >= 0 ? '+' : ''}$
                                  {Math.abs(pl).toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </div>
                                <div className="text-xs opacity-80">
                                  {pl >= 0 ? '+' : ''}
                                  {plPct.toFixed(2)}%
                                </div>
                              </td>
                              <td className="py-4 text-right">
                                <button
                                  onClick={() => handleSellClick(portfolio.id, holding)}
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
          ))}
        </div>
      )}
    </div>
  )
}
