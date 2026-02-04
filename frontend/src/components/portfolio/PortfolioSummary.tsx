import type { Portfolio } from '@/store/api/gameApi'

interface PortfolioSummaryProps {
  portfolio: Portfolio
  holdingsValue: number
  totalMarketValue: number
  totalPL: number
}

export function PortfolioSummary({
  portfolio,
  holdingsValue,
  totalMarketValue,
  totalPL,
}: PortfolioSummaryProps) {
  return (
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
  )
}
