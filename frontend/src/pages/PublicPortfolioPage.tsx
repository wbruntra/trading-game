import { useParams } from 'react-router-dom'
import { useGetPortfolioQuery } from '@/store/api/gameApi'
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary'
import { HoldingsList } from '@/components/portfolio/HoldingsList'

export default function PublicPortfolioPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const {
    data: portfolio,
    isLoading,
    error,
  } = useGetPortfolioQuery(portfolioId!, {
    skip: !portfolioId,
  })

  if (isLoading) return <div className="p-8 text-white">Loading portfolio...</div>
  if (error || !portfolio) {
    return (
      <div className="min-h-screen p-8 text-white">
        <h1 className="text-3xl font-bold mb-4">Portfolio Not Found</h1>
        <p className="text-gray-400">The requested portfolio could not be found.</p>
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">{portfolio.competition_name}</h1>
        <p className="text-gray-400 text-sm">Portfolio View</p>
      </div>

      <PortfolioSummary
        portfolio={portfolio}
        holdingsValue={holdingsValue}
        totalMarketValue={totalMarketValue}
        totalPL={totalPL}
      />

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Holdings</h2>
        <HoldingsList holdings={portfolio.holdings || []} readOnly={true} />
      </div>
    </div>
  )
}
