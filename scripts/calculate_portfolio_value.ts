import knex from 'knex'
import path from 'path'
import YahooFinance from 'yahoo-finance2'

// Database setup
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: path.resolve('backend/dev.sqlite3'),
  },
  useNullAsDefault: true,
})

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function calculatePortfolioValue(portfolioId: number) {
  console.log(`📊 Calculating current value for Portfolio ID: ${portfolioId}...\n`)

  try {
    // 1. Fetch Portfolio
    const portfolio = await db('portfolios').where({ id: portfolioId }).first()
    if (!portfolio) {
      console.error('❌ Portfolio not found.')
      process.exit(1)
    }

    // 2. Fetch Trades
    const trades = await db('trades')
      .where({ portfolio_id: portfolioId })
      .orderBy('timestamp', 'asc')

    // 3. Calculate Holdings
    const holdingsMap = new Map<
      string,
      { symbol: string; quantity: number; avgPrice: number; totalCost: number }
    >()

    for (const trade of trades) {
      if (!holdingsMap.has(trade.option_symbol)) {
        holdingsMap.set(trade.option_symbol, {
          symbol: trade.symbol,
          quantity: 0,
          avgPrice: 0,
          totalCost: 0,
        })
      }
      const h = holdingsMap.get(trade.option_symbol)!
      if (trade.type === 'BUY') {
        h.quantity += trade.quantity
        h.totalCost += trade.price * trade.quantity * 100
      } else {
        const costBasis = (h.totalCost / (h.quantity * 100)) * (trade.quantity * 100)
        h.quantity -= trade.quantity
        h.totalCost -= costBasis
      }
    }

    const activeHoldings = Array.from(holdingsMap.entries())
      .filter(([_, h]) => h.quantity > 0)
      .map(([optSymbol, h]) => ({ optSymbol, ...h }))

    console.log(`💰 Cash Balance: $${portfolio.cash_balance.toLocaleString()}`)
    console.log(`📦 Active Holdings: ${activeHoldings.length}\n`)

    let totalHoldingsValue = 0

    // 4. Fetch All Prices in One Batch
    const optionSymbols = activeHoldings.map((h) => h.optSymbol)
    const quotes = await yahooFinance.quote(optionSymbols)
    const quotesMap = new Map(
      (Array.isArray(quotes) ? quotes : [quotes]).map((q) => [q.symbol, q]),
    )

    console.log('--- Holdings Breakdown ---')
    for (const h of activeHoldings) {
      const quote = quotesMap.get(h.optSymbol)
      const currentPrice = quote?.regularMarketPrice || 0
      const currentValue = currentPrice * h.quantity * 100
      totalHoldingsValue += currentValue

      const pl = currentValue - h.totalCost
      const plPct = (pl / h.totalCost) * 100

      console.log(`${h.optSymbol}:`)
      console.log(`  Qty:        ${h.quantity}`)
      console.log(
        `  Avg Cost:   $${(h.totalCost / (h.quantity * 100)).toFixed(
          2,
        )} ($${h.totalCost.toLocaleString()} total)`,
      )
      console.log(
        `  Current:    $${currentPrice.toFixed(2)} ($${currentValue.toLocaleString()} total)`,
      )
      console.log(`  P/L:        $${pl.toLocaleString()} (${plPct.toFixed(2)}%)`)
      console.log('')
    }

    const totalValue = portfolio.cash_balance + totalHoldingsValue
    const totalPL = totalValue - 100000 // Assuming 100k starting balance

    console.log('---------------------------')
    console.log(`Total Holdings Value: $${totalHoldingsValue.toLocaleString()}`)
    console.log(`PORTFOLIO TOTAL VALUE: $${totalValue.toLocaleString()}`)
    console.log(
      `Overall P/L:          $${totalPL.toLocaleString()} (${(
        (totalValue - 100000) /
        1000
      ).toFixed(2)}%)`,
    )
    console.log('---------------------------')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await db.destroy()
  }
}

calculatePortfolioValue(2)
