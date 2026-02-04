import { formatExpiration } from '@/utils/formatters'
import type { Holding } from '@/store/api/gameApi'

interface HoldingsListProps {
  holdings: Holding[]
  readOnly?: boolean
  onSell?: (holding: Holding) => void
}

export function HoldingsList({ holdings, readOnly = false, onSell }: HoldingsListProps) {
  if (!holdings || holdings.length === 0) {
    return <p className="text-gray-500 italic">No active positions.</p>
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        {holdings.map((holding) => {
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
                  <span className="text-sm text-gray-400 font-mono self-center">
                    ${holding.strike.toFixed(2)}
                  </span>
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
                {!readOnly && onSell && (
                  <button
                    onClick={() => onSell(holding)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-sm font-semibold text-red-400 border border-red-600/50 transition-colors"
                  >
                    Sell
                  </button>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Quantity</div>
                  <div className="font-mono font-semibold">{holding.quantity}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Strike</div>
                  <div className="font-mono font-semibold">${holding.strike.toFixed(2)}</div>
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
                  <div className="text-xs text-gray-500 mb-0.5">Expires</div>
                  <div className="font-mono font-semibold">
                    {formatExpiration(holding.expirationDate)}
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
              <th className="py-3">Strike</th>
              <th className="py-3">Side</th>
              <th className="py-3 text-right">Qty</th>
              <th className="py-3 text-right">Avg Price</th>
              <th className="py-3 text-right">Expires</th>
              <th className="py-3 text-right">Current</th>
              <th className="py-3 text-right">Value</th>
              <th className="py-3 text-right">P/L</th>
              {!readOnly && <th className="py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const marketValue = (holding.lastPrice || 0) * holding.quantity * 100
              const pl = marketValue - holding.totalCost
              const plPct = holding.totalCost > 0 ? (pl / holding.totalCost) * 100 : 0

              return (
                <tr
                  key={holding.optionSymbol}
                  className="border-b border-gray-700/50 hover:bg-gray-700/20"
                >
                  <td className="py-4 font-bold">{holding.symbol}</td>
                  <td className="py-4 font-mono">${holding.strike.toFixed(2)}</td>
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
                    {formatExpiration(holding.expirationDate)}
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
                  {!readOnly && onSell && (
                    <td className="py-4 text-right">
                      <button
                        onClick={() => onSell(holding)}
                        className="px-3 py-1 bg-gray-700 hover:bg-red-600 hover:text-white rounded text-sm transition-colors"
                      >
                        Sell
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
