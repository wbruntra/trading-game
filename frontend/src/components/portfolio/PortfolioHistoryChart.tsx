import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { PortfolioHistoryEntry } from '@/store/api/gameApi'

interface PortfolioHistoryChartProps {
  data: PortfolioHistoryEntry[]
  initialBalance?: number
}

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload
    const isProfit = dataPoint.profit >= 0
    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-xl">
        <p className="text-gray-400 text-sm mb-1">
          {new Date(dataPoint.timestamp).toLocaleString()}
        </p>
        <p className="text-white font-mono font-bold">
          Total Value: ${dataPoint.totalValue.toLocaleString()}
        </p>
        <p className={`font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          P/L: {isProfit ? '+' : ''}${dataPoint.profit.toLocaleString()}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Cash: ${dataPoint.cashBalance.toLocaleString()}
        </p>
      </div>
    )
  }
  return null
}

export function PortfolioHistoryChart({ data, initialBalance = 100000 }: PortfolioHistoryChartProps) {
  const chartData = useMemo(() => {
    return data.map((entry) => ({
      timestamp: entry.timestamp,
      totalValue: entry.totalValue,
      cashBalance: entry.cashBalance,
      profit: entry.totalValue - initialBalance,
    }))
  }, [data, initialBalance])

  const gradientOffset = useMemo(() => {
    if (chartData.length === 0) return 0.5
    const dataMax = Math.max(...chartData.map((d) => d.profit))
    const dataMin = Math.min(...chartData.map((d) => d.profit))

    if (dataMax <= 0) {
      return 0
    }
    if (dataMin >= 0) {
      return 1
    }

    return dataMax / (dataMax - dataMin)
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-400">
        No portfolio history data available yet.
      </div>
    )
  }

  const currentValue = chartData[chartData.length - 1]?.totalValue || initialBalance
  const totalProfit = currentValue - initialBalance
  const profitPercent = ((totalProfit / initialBalance) * 100).toFixed(2)

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-sm text-gray-400">Initial Balance</p>
          <p className="text-white font-mono font-bold">${initialBalance.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-400">Current Value</p>
          <p className="text-white font-mono font-bold">${currentValue.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total P/L</p>
          <p className={`font-mono font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()} ({totalProfit >= 0 ? '+' : ''}
            {profitPercent}%)
          </p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset={gradientOffset} stopColor="#f87171" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke="#9ca3af"
              tickFormatter={(val) => {
                const date = new Date(val)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
              minTickGap={30}
            />
            <YAxis
              stroke="#9ca3af"
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="url(#portfolioGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-xs text-gray-500 text-center">
        * Portfolio value history showing total value over time
      </div>
    </div>
  )
}
