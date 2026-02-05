import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface ProfitLossGraphProps {
  strikePrice: number
  premium: number // Cost per share
  isCall: boolean
  currentPrice: number
  quantity?: number
}

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload
    const isProfit = dataPoint.profit >= 0
    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-xl">
        <p className="text-gray-400 text-sm mb-1">
          At Share Price:{' '}
          <span className="text-white font-mono">${dataPoint.price.toFixed(2)}</span>
        </p>
        <p className={`font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          {isProfit ? 'Profit' : 'Loss'}: ${Math.abs(dataPoint.profit).toFixed(2)}
        </p>
      </div>
    )
  }
  return null
}

export function ProfitLossGraph({
  strikePrice,
  premium,
  isCall,
  currentPrice,
  quantity = 1,
}: ProfitLossGraphProps) {
  const data = useMemo(() => {
    const breakEven = isCall ? strikePrice + premium : strikePrice - premium

    // Identify key points of interest
    const attributes = [currentPrice, strikePrice, breakEven]
    const minInterest = Math.min(...attributes)
    const maxInterest = Math.max(...attributes)

    // Calculate a margin to show context around the interesting points
    // Use 20% of the spread between interesting points, or at least 15% of the strike price as a baseline fallback
    // to ensure we don't zoom in too much if points are very close.
    const spread = maxInterest - minInterest
    const margin = Math.max(spread * 0.5, strikePrice * 0.15)

    const startPrice = Math.max(0, minInterest - margin)
    const endPrice = maxInterest + margin

    // Generate points
    const points = []
    const steps = 100
    const stepSize = (endPrice - startPrice) / steps

    for (let i = 0; i <= steps; i++) {
      const price = startPrice + i * stepSize
      let value = 0
      if (isCall) {
        value = Math.max(0, price - strikePrice) - premium
      } else {
        value = Math.max(0, strikePrice - price) - premium
      }

      // Multiply by quantity and 100 shares per contract
      const totalProfit = value * 100 * quantity

      points.push({
        price: price,
        profit: totalProfit,
      })
    }
    return points
  }, [strikePrice, premium, isCall, currentPrice, quantity])

  // Calculate Break Even for display
  const breakEvenPrice = isCall ? strikePrice + premium : strikePrice - premium

  // Gradient offsets for coloring area above/below 0
  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.profit))
    const dataMin = Math.min(...data.map((i) => i.profit))

    if (dataMax <= 0) {
      return 0
    }
    if (dataMin >= 0) {
      return 1
    }

    return dataMax / (dataMax - dataMin)
  }

  const off = gradientOffset()

  return (
    <div className="w-full">
      <div className="flex justify-between mb-4 text-sm text-gray-400">
        <div>
          <span className="block text-xs uppercase tracking-wider">Break Even</span>
          <span className="text-white font-mono font-bold">${breakEvenPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="block text-xs uppercase tracking-wider">Max Loss</span>
          <span className="text-red-400 font-mono font-bold">
            ${(premium * 100 * quantity).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="block text-xs uppercase tracking-wider">Max Profit</span>
          <span className="text-green-400 font-mono font-bold">
            {isCall ? 'Unlimited' : `$${((strikePrice - premium) * 100 * quantity).toFixed(2)}`}
          </span>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset={off} stopColor="#f87171" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="price"
              stroke="#9ca3af"
              tickFormatter={(val) => `$${val.toFixed(0)}`}
              minTickGap={30}
            />
            <YAxis stroke="#9ca3af" tickFormatter={(val) => `$${val}`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              x={currentPrice}
              stroke="#60a5fa"
              strokeDasharray="3 3"
              label={{ position: 'top', value: 'Current', fill: '#60a5fa', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#fff"
              strokeWidth={2}
              fill="url(#splitColor)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-xs text-gray-500 text-center">
        * Theoretical returns at expiration. Does not account for volatility or time decay before
        expiration.
      </div>
    </div>
  )
}
