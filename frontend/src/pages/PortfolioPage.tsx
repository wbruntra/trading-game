import { useState } from 'react'
import {
  useGetPortfolioByCompetitionQuery,
  usePlaceTradeMutation,
  useCloseSpreadMutation,
} from '@/store/api/gameApi'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary'
import { HoldingsList } from '@/components/portfolio/HoldingsList'

export default function PortfolioPage() {
  const { activeCompetitionId } = useSelector((state: RootState) => state.game)
  const { data: portfolio, isLoading } = useGetPortfolioByCompetitionQuery(activeCompetitionId!, {
    skip: !activeCompetitionId,
    pollingInterval: 30000, // Refresh every 30 seconds
  })
  const [placeTrade] = usePlaceTradeMutation()
  const [closeSpread] = useCloseSpreadMutation()
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
      if (selectedHolding.spreadId) {
        await closeSpread({
          spreadId: selectedHolding.spreadId,
        }).unwrap()
        toast.success('Spread closed successfully!')
      } else {
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
      }
      setModalOpen(false)
    } catch (err: any) {
      toast.error(`Failed to close position: ${err.data?.error || err.message}`)
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

      <PortfolioSummary
        portfolio={portfolio}
        holdingsValue={holdingsValue}
        totalMarketValue={totalMarketValue}
        totalPL={totalPL}
      />

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Current Holdings</h2>
        <HoldingsList holdings={portfolio.holdings || []} onSell={handleSellClick} />
      </div>
    </div>
  )
}
