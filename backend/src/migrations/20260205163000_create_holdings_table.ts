import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. Create Table
  await knex.schema.createTable('holdings', (table) => {
    table.increments('id').primary()
    table
      .integer('portfolio_id')
      .references('id')
      .inTable('portfolios')
      .onDelete('CASCADE')
      .notNullable()
    table.string('symbol').notNullable() // Underlying symbol (e.g., AAPL)
    table.string('option_symbol').notNullable() // Option symbol (e.g., AAPL240621C00200000)
    table.string('side').notNullable() // CALL, PUT
    table.integer('quantity').notNullable()
    table.decimal('cost_basis', 14, 2).notNullable()
    table.string('spread_id').nullable()

    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index(['portfolio_id', 'option_symbol'])
    table.index(['portfolio_id', 'spread_id'])
  })

  // 2. Populate Data from existing trades
  const trades = await knex('trades').orderBy('timestamp', 'asc')

  // Group trades by portfolio for isolated calculation
  const tradesByPortfolio = new Map<number, any[]>()
  trades.forEach((t) => {
    let group = tradesByPortfolio.get(t.portfolio_id)
    if (!group) {
      group = []
      tradesByPortfolio.set(t.portfolio_id, group)
    }
    group.push(t)
  })

  const holdingsToInsert: any[] = []

  for (const [portfolioId, pTrades] of tradesByPortfolio) {
    const holdingsMap = calculateHoldingsMap(pTrades)

    // Convert processed holdings map to insertable database rows
    holdingsMap.forEach((h: any) => {
      if (h.spreadId && h.longLeg && h.shortLeg) {
        // Spreads are stored as two separate rows (long and short legs)
        holdingsToInsert.push({
          portfolio_id: portfolioId,
          symbol: h.symbol,
          option_symbol: h.longLeg.optionSymbol,
          side: h.side,
          quantity: h.quantity,
          cost_basis: h.longLeg.avgPrice * h.quantity * 100,
          spread_id: h.spreadId,
        })
        holdingsToInsert.push({
          portfolio_id: portfolioId,
          symbol: h.symbol,
          option_symbol: h.shortLeg.optionSymbol,
          side: h.side,
          quantity: -h.quantity,
          cost_basis: -h.shortLeg.avgPrice * h.quantity * 100,
          spread_id: h.spreadId,
        })
      } else {
        // Standard (non-spread) positions
        holdingsToInsert.push({
          portfolio_id: portfolioId,
          symbol: h.symbol,
          option_symbol: h.optionSymbol,
          side: h.side,
          quantity: h.quantity,
          cost_basis: h.totalCost,
          spread_id: null,
        })
      }
    })
  }

  if (holdingsToInsert.length > 0) {
    await knex('holdings').insert(holdingsToInsert)
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('holdings')
}

/**
 * Reconstructs current holdings from a chronological list of trades.
 */
function calculateHoldingsMap(trades: any[]) {
  const holdingsMap = new Map<string, any>()
  const processedTradeIds = new Set<number>()
  const spreadGroups = new Map<string, any[]>()

  // First pass: Group and process spread trades
  trades.forEach((trade) => {
    if (trade.spread_id) {
      let group = spreadGroups.get(trade.spread_id)
      if (!group) {
        group = []
        spreadGroups.set(trade.spread_id, group)
      }
      group.push(trade)
      processedTradeIds.add(trade.id)
    }
  })

  spreadGroups.forEach((groupTrades, spreadId) => {
    // Only process completed spread pairs
    if (groupTrades.length !== 2) return

    const buyLeg = groupTrades.find((t: any) => t.type === 'BUY')
    const sellLeg = groupTrades.find((t: any) => t.type === 'SELL')

    if (!buyLeg || !sellLeg) return

    const holdingKey = `SPREAD:${spreadId}`
    const quantity = buyLeg.quantity
    const totalCost = buyLeg.price * buyLeg.quantity * 100 - sellLeg.price * sellLeg.quantity * 100

    holdingsMap.set(holdingKey, {
      symbol: buyLeg.symbol,
      side: buyLeg.side,
      quantity,
      totalCost,
      spreadId,
      longLeg: {
        optionSymbol: buyLeg.option_symbol,
        avgPrice: buyLeg.price,
      },
      shortLeg: {
        optionSymbol: sellLeg.option_symbol,
        avgPrice: sellLeg.price,
      },
    })
  })

  // Second pass: Process individual (non-spread) trades
  for (const trade of trades) {
    if (processedTradeIds.has(trade.id)) continue

    let holding = holdingsMap.get(trade.option_symbol)
    if (!holding) {
      holding = {
        symbol: trade.symbol,
        optionSymbol: trade.option_symbol,
        side: trade.side,
        quantity: 0,
        totalCost: 0,
      }
      holdingsMap.set(trade.option_symbol, holding)
    }

    if (trade.type === 'BUY') {
      holding.totalCost += trade.price * trade.quantity * 100
      holding.quantity += trade.quantity
    } else if (trade.type === 'SELL') {
      // Avoid division by zero when closing a position
      const avgPrice = holding.quantity > 0 ? holding.totalCost / (holding.quantity * 100) : 0
      const costRemoved = trade.quantity * 100 * avgPrice
      holding.totalCost -= costRemoved
      holding.quantity -= trade.quantity
    }
  }

  // Filter out closed or empty positions
  for (const [key, val] of holdingsMap) {
    if (val.quantity <= 0) {
      holdingsMap.delete(key)
    }
  }

  return holdingsMap
}
