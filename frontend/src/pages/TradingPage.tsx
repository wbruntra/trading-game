import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  useGetOptionsChainQuery,
  usePlaceTradeMutation,
  useSaveTradeMutation,
  useGetSavedTradesQuery,
  useDeleteSavedTradeMutation,
  useExecuteSavedTradeMutation,
} from '@/store/api/gameApi'
import { useSelector, useDispatch } from 'react-redux'
import { setActiveCompetition } from '@/store/slices/gameSlice'

export default function TradingPage() {
  const { activeCompetitionId } = useSelector((state: any) => state.game)
  const dispatch = useDispatch()

  const [searchParams] = useSearchParams()
  const urlCompetitionId = searchParams.get('competitionId')
  const navigate = useNavigate()

  const [symbol, setSymbol] = useState('')
  const [searchSymbol, setSearchSymbol] = useState('')
  const [selectedOption, setSelectedOption] = useState<any>(null)

  // Prioritize URL param, then Redux state
  const effectiveCompetitionId = urlCompetitionId || activeCompetitionId || ''

  const [selectedCompetition, setSelectedCompetition] = useState(effectiveCompetitionId)
  const [quantity, setQuantity] = useState(1)
  const [selectedDate, setSelectedDate] = useState<number | undefined>(undefined)
  const [selectedDateIndex, setSelectedDateIndex] = useState(0)
  const [tradeSide, setTradeSide] = useState<'CALL' | 'PUT'>('CALL')

  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    data: optionsChain,
    isLoading,
    error,
  } = useGetOptionsChainQuery(
    {
      symbol: searchSymbol,
      date: selectedDate,
    },
    { skip: !searchSymbol },
  )

  const [placeTrade] = usePlaceTradeMutation()
  const [saveTrade] = useSaveTradeMutation()
  const [deleteSavedTrade] = useDeleteSavedTradeMutation()
  const [executeSavedTrade] = useExecuteSavedTradeMutation()

  const { data: savedTrades = [] } = useGetSavedTradesQuery(selectedCompetition, {
    skip: !selectedCompetition,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchSymbol(symbol)
  }

  useEffect(() => {
    if (urlCompetitionId) {
      setSelectedCompetition(urlCompetitionId)
      // Also update redux state if not set? User might share a link.
      // Better to respect user's explicit navigation (URL).
      dispatch(setActiveCompetition(urlCompetitionId))
    } else if (activeCompetitionId) {
      setSelectedCompetition(activeCompetitionId)
    }
  }, [urlCompetitionId, activeCompetitionId, dispatch])

  // ... (existing code)

  const handleTrade = async () => {
    if (!selectedCompetition || !selectedOption) return

    try {
      await placeTrade({
        competitionId: selectedCompetition,
        trade: {
          symbol: searchSymbol,
          optionSymbol: selectedOption.contractSymbol,
          type: 'BUY',
          side: tradeSide,
          quantity,
        },
      }).unwrap()
      toast.success('Trade placed successfully!')
      navigate('/portfolio')
    } catch (err: any) {
      toast.error(`Trade failed: ${err.data?.error || 'Unknown error'}`)
    }
  }

  const handleSaveForLater = async () => {
    if (!selectedCompetition || !selectedOption) return

    try {
      await saveTrade({
        competitionId: selectedCompetition,
        trade: {
          symbol: searchSymbol,
          optionSymbol: selectedOption.contractSymbol,
          type: 'BUY',
          side: tradeSide,
          quantity,
          strikePrice: selectedOption.strike,
          expirationDate: selectedDate!,
        },
      }).unwrap()
      toast.success('Trade saved for later!')
      setSelectedOption(null)
    } catch (err: any) {
      toast.error(`Failed to save trade: ${err.data?.error || 'Unknown error'}`)
    }
  }

  const handleExecuteSavedTrade = async (savedTradeId: number) => {
    try {
      await executeSavedTrade(savedTradeId).unwrap()
      toast.success('Trade executed successfully!')
    } catch (err: any) {
      toast.error(`Trade failed: ${err.data?.error || 'Unknown error'}`)
    }
  }

  const handleDeleteSavedTrade = async (savedTradeId: number) => {
    try {
      await deleteSavedTrade(savedTradeId).unwrap()
      toast.success('Saved trade deleted')
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.data?.error || 'Unknown error'}`)
    }
  }

  const currentPrice =
    optionsChain?.underlyingPrice || optionsChain?.quote?.regularMarketPrice || 0

  // Combine calls and puts into a single list sorted by strike
  // For Robinhood style, we typically show just Calls or just Puts list
  // but with the current price inserted correctly.

  const currentOptions = optionsChain?.options?.[0]
    ? tradeSide === 'CALL'
      ? optionsChain.options[0].calls
      : optionsChain.options[0].puts
    : []

  // Sort options by strike price (High to Low)
  const sortedOptions = [...currentOptions].sort((a, b) => b.strike - a.strike)

  // Find where to insert current price (First strike LOWER than price)
  const insertIndex = sortedOptions.findIndex((opt) => opt.strike < currentPrice)

  return (
    <div className="min-h-screen p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8">Trade Options</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4 mb-8">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Enter Stock Symbol (e.g. SPY)"
          className="flex-1 max-w-md px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 font-mono text-lg text-white placeholder-gray-500"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Get Chain
        </button>
      </form>

      {isLoading && <div>Loading options chain...</div>}
      {error && <div className="text-red-400">Failed to load options chain</div>}

      {optionsChain && (
        <div className="grid lg:grid-cols-3 gap-8 h-[calc(100vh-250px)]">
          {/* Options Chain Display */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl flex flex-col overflow-hidden shadow-xl border border-gray-700/50">
            {/* Header */}
            <div className="p-6 border-b border-gray-700/50 bg-gradient-to-b from-gray-800 to-gray-800/50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-3xl font-bold flex items-baseline gap-3">
                    {optionsChain.symbol}
                    {optionsChain.quote?.longName && (
                      <span className="text-lg font-normal text-gray-400">
                        {optionsChain.quote.longName}
                      </span>
                    )}
                  </h2>
                </div>
                <div className="text-3xl font-mono text-green-400">${currentPrice.toFixed(2)}</div>
              </div>

              {/* Call / Put Toggle */}
              <div className="flex bg-gray-900/50 p-1 rounded-lg mb-6 w-fit shadow-inner border border-gray-700/50">
                <button
                  onClick={() => setTradeSide('CALL')}
                  className={`px-6 py-2.5 rounded-md font-semibold transition-all duration-200 ${
                    tradeSide === 'CALL'
                      ? 'bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg shadow-green-900/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  Buy Calls
                </button>
                <button
                  onClick={() => setTradeSide('PUT')}
                  className={`px-6 py-2.5 rounded-md font-semibold transition-all duration-200 ${
                    tradeSide === 'PUT'
                      ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-lg shadow-red-900/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  Buy Puts
                </button>
              </div>

              {/* Expiration Tabs */}
              {optionsChain.expirationDates && (
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600">
                  {optionsChain.expirationDates.map((date, i) => {
                    const d = new Date(date)
                    const isCurrentYear = d.getFullYear() === new Date().getFullYear()
                    const isSelected = selectedDateIndex === i
                    
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          // Convert ISO string to timestamp (seconds) for the API
                          const timestamp = Math.floor(new Date(date).getTime() / 1000)
                          setSelectedDate(timestamp)
                          setSelectedDateIndex(i)
                          setSelectedOption(null)
                        }}
                        className={`px-5 py-2.5 rounded-full whitespace-nowrap transition-all duration-200 text-sm font-medium border ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-400/50 shadow-lg shadow-amber-900/50'
                            : 'bg-gray-800/50 text-gray-300 border-gray-700/50 hover:bg-gray-700/70 hover:border-gray-600 hover:text-white hover:shadow-md'
                        }`}
                      >
                        {format(d, isCurrentYear ? 'MMM d' : 'MMM d, yyyy')}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
              <div className="space-y-1">
                <div className="grid grid-cols-4 text-xs font-semibold text-gray-500 px-4 mb-2 uppercase tracking-wide">
                  <span>Strike Price</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">% Change</span>
                  <span className="text-right">To Break Even</span>
                </div>

                {sortedOptions.map((opt, index) => {
                  const isSelected = selectedOption?.contractSymbol === opt.contractSymbol
                  const isAtMoney = index === insertIndex

                  // Calculate Break Even %
                  const breakEvenPrice =
                    tradeSide === 'CALL' ? opt.strike + opt.lastPrice : opt.strike - opt.lastPrice

                  const breakEvenPct = ((breakEvenPrice - currentPrice) / currentPrice) * 100
                  const isPositive = breakEvenPct > 0

                  return (
                    <div key={opt.contractSymbol}>
                      {isAtMoney && (
                        <div
                          id="current-price-row"
                          className="flex items-center gap-4 py-4 px-4 my-2 opacity-70"
                        >
                          <div className="h-px bg-green-500 flex-1"></div>
                          <span className="font-mono font-bold text-green-400">
                            $
                            {currentPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <div className="h-px bg-green-500 flex-1"></div>
                        </div>
                      )}
                      <div
                        onClick={() => setSelectedOption(opt)}
                        className={`grid grid-cols-4 p-4 rounded-lg cursor-pointer text-sm transition-all border border-transparent ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 shadow-lg relative z-10'
                            : 'hover:bg-gray-700'
                        }`}
                      >
                        <span className="font-mono font-bold text-white">${opt.strike}</span>
                        <span
                          className={`text-right font-mono ${
                            isSelected
                              ? 'text-blue-300'
                              : tradeSide === 'CALL'
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          $
                          {(opt.lastPrice * 100).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-right text-gray-400">-</span>
                        <span
                          className={`text-right font-mono ${
                            isPositive ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {breakEvenPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Trade Form */}
          <div className="bg-gray-800 p-6 rounded-xl h-fit shadow-xl border border-gray-700/50">
            <h2 className="text-xl font-bold mb-6">Order Ticket</h2>

            {!selectedOption ? (
              <div className="text-center py-12 text-gray-500">
                <p>Select an option to view details</p>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 shadow-inner">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Contract</span>
                    <span className="font-mono text-sm">{selectedOption.contractSymbol}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Break Even</span>
                    <span className="font-mono">
                      $
                      {(tradeSide === 'CALL'
                        ? selectedOption.strike + selectedOption.lastPrice
                        : selectedOption.strike - selectedOption.lastPrice
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-gray-400">Ask</span>
                    <span className="font-bold text-2xl text-green-400">
                      $
                      {(selectedOption.lastPrice * 100).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Quantity</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center bg-transparent font-mono text-xl border-b border-gray-600 focus:border-blue-500 outline-none pb-1"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-4">
                  <span>Estimated Cost</span>
                  <span>
                    $
                    {(selectedOption.lastPrice * quantity * 100).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>

                <button
                  onClick={handleTrade}
                  disabled={!selectedCompetition}
                  className="w-full py-4 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-600 disabled:to-gray-700 rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Place Order
                </button>

                <button
                  onClick={handleSaveForLater}
                  disabled={!selectedCompetition}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 border border-gray-600 hover:border-gray-500"
                >
                  Save for Later
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Trades Section */}
      {selectedCompetition && savedTrades.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Saved Trades</h2>
          <div className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700/50">
            <div className="space-y-3">
              {savedTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">{trade.symbol}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          trade.side === 'CALL'
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-red-900/50 text-red-400'
                        }`}
                      >
                        {trade.side}
                      </span>
                      <span className="text-gray-400 text-sm">
                        ${trade.strike_price} •{' '}
                        {format(new Date(trade.expiration_date * 1000), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Qty: {trade.quantity} • {trade.option_symbol}
                    </div>
                    {trade.note && (
                      <div className="text-sm text-gray-500 mt-1 italic">{trade.note}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExecuteSavedTrade(trade.id)}
                      className="px-4 py-2 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg font-semibold text-sm shadow-md transition-all duration-200"
                    >
                      Execute
                    </button>
                    <button
                      onClick={() => handleDeleteSavedTrade(trade.id)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg font-semibold text-sm text-red-400 border border-red-600/50 transition-all duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
