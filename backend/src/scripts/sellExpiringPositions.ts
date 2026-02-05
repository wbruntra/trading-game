import db from '../config/db' // Using relative path to be safe, though @ might work
import tradingService from '../services/tradingService'

// Helper to determine side from option symbol
function getSide(optionSymbol: string): 'CALL' | 'PUT' {
  const match = optionSymbol.match(/\d{6}([CP])\d{8}/)
  if (match && match[1] === 'C') return 'CALL'
  if (match && match[1] === 'P') return 'PUT'
  throw new Error(`Invalid option symbol format: ${optionSymbol}`)
}

async function main() {
  try {
    const today = new Date().toISOString().split('T')[0]
    console.log(`[AutoSell] Running for expiration date: ${today}`)

    // Find positions expiring today with net_qty > 0
    const expiringPositions = (await db('trades')
      .join('portfolios', 'trades.portfolio_id', 'portfolios.id')
      .select(
        'trades.portfolio_id',
        'trades.option_symbol',
        'trades.symbol',
        'portfolios.user_id',
        'portfolios.competition_id',
      )
      .sum({
        net_qty: db.raw(
          "CASE WHEN trades.type = 'BUY' THEN trades.quantity ELSE -trades.quantity END",
        ),
      })
      .where('trades.expiration_date', today)
      .groupBy(
        'trades.portfolio_id',
        'trades.option_symbol',
        'trades.symbol',
        'portfolios.user_id',
        'portfolios.competition_id',
      )
      .having('net_qty', '>', 0)) as any // Cast to any to bypass Knex type inference issues with aggregation extensions

    console.log(`[AutoSell] Found ${expiringPositions.length} positions to close.`)

    for (const pos of expiringPositions) {
      const { portfolio_id, option_symbol, symbol, user_id, competition_id, net_qty } = pos
      const quantity = Number(net_qty)

      console.log(
        `[AutoSell] Selling ${quantity} of ${option_symbol} for Portfolio ${portfolio_id} (User ${user_id})`,
      )

      try {
        const side = getSide(option_symbol)

        await tradingService.placeTrade(user_id, competition_id, {
          symbol,
          optionSymbol: option_symbol,
          type: 'SELL',
          side,
          quantity,
        })

        console.log(`[AutoSell] SUCCESS: Sold ${option_symbol}`)
      } catch (error) {
        console.error(
          `[AutoSell] FAILED to sell ${option_symbol} for Portfolio ${portfolio_id}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }

    console.log('[AutoSell] Completed.')
  } catch (error) {
    console.error('[AutoSell] Script Error:', error)
    throw error // Re-throw for caller to handle or test to catch
  }
}

if (import.meta.main) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export const runAutoSell = main
