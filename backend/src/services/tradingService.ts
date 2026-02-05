import db from '@/config/db'
import marketDataService from '@/services/marketDataService'
import { isMarketOpen } from '@/utils/marketHours'
import short from 'short-uuid'

export class TradingService {
  private calculateHoldings(trades: any[]) {
    const holdingsMap = new Map<
      string,
      {
        symbol: string
        optionSymbol: string
        side: 'CALL' | 'PUT'
        quantity: number
        totalCost: number
        avgPrice: number
        strike: number
        expirationDate: string
        lastPrice?: number
        underlyingPrice?: number
        spreadId?: string
        spreadType?: 'CALL_DEBIT' | 'PUT_DEBIT'
        longLeg?: any
        shortLeg?: any
      }
    >()

    // First pass: Process spread trades (grouped by spread_id)
    const processedTradeIds = new Set<number>()
    const spreadGroups = new Map<string, any[]>()

    trades.forEach((trade) => {
      if (trade.spread_id) {
        if (!spreadGroups.has(trade.spread_id)) {
          spreadGroups.set(trade.spread_id, [])
        }
        spreadGroups.get(trade.spread_id)!.push(trade)
        processedTradeIds.add(trade.id)
      }
    })

    // Create spread holdings
    spreadGroups.forEach((groupTrades, spreadId) => {
      // Expect exactly 2 trades for a spread
      if (groupTrades.length !== 2) return

      const buyLeg = groupTrades.find((t) => t.type === 'BUY')
      const sellLeg = groupTrades.find((t) => t.type === 'SELL')

      if (!buyLeg || !sellLeg) return

      // Determine spread type based on leg side
      // Both legs should be same side (CALL or PUT)
      const spreadType = buyLeg.side === 'CALL' ? 'CALL_DEBIT' : 'PUT_DEBIT'

      // Use the buy leg's option symbol as the unique key for the spread holding for now
      // Or better, use "SPREAD:spreadId"
      const holdingKey = `SPREAD:${spreadId}`

      // Calculate aggregated stats
      // Net cost = (Buy Price * Qty) - (Sell Price * Qty)
      // Since it's a debit spread, we paid for buy leg and received for sell leg
      const totalCost =
        buyLeg.price * buyLeg.quantity * 100 - sellLeg.price * sellLeg.quantity * 100

      // Quantity should be same for standard spread
      const quantity = buyLeg.quantity

      // Construct detailed legs info
      const longLeg = {
        optionSymbol: buyLeg.option_symbol,
        strike: 0, // Will parse
        avgPrice: buyLeg.price,
      }
      const shortLeg = {
        optionSymbol: sellLeg.option_symbol,
        strike: 0, // Will parse
        avgPrice: sellLeg.price,
      }

      // Parse strikes
      const longMatch = longLeg.optionSymbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
      if (longMatch) longLeg.strike = parseInt(longMatch[4], 10) / 1000

      const shortMatch = shortLeg.optionSymbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
      if (shortMatch) shortLeg.strike = parseInt(shortMatch[4], 10) / 1000

      holdingsMap.set(holdingKey, {
        symbol: buyLeg.symbol,
        optionSymbol: `${buyLeg.symbol} ${spreadType === 'CALL_DEBIT' ? 'Call' : 'Put'} Spread`, // Display name
        side: buyLeg.side,
        quantity,
        totalCost,
        avgPrice: totalCost / (quantity * 100),
        strike: longLeg.strike, // Use long leg strike as primary reference or display range
        expirationDate: buyLeg.expiration_date,
        spreadId,
        spreadType,
        longLeg,
        shortLeg,
      })
    })

    // Second pass: Process individual trades
    for (const trade of trades) {
      if (processedTradeIds.has(trade.id)) continue

      if (!holdingsMap.has(trade.option_symbol)) {
        // Parse strike from option symbol (e.g., AAPL260204C00250000)
        const match = trade.option_symbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
        let strike = 0
        let expirationDate = trade.expiration_date || ''

        if (match) {
          if (!expirationDate) {
            expirationDate = match[2]
          }
          strike = parseInt(match[4], 10) / 1000
        }

        holdingsMap.set(trade.option_symbol, {
          symbol: trade.symbol,
          optionSymbol: trade.option_symbol,
          side: trade.side,
          quantity: 0,
          totalCost: 0,
          avgPrice: 0,
          strike,
          expirationDate,
        })
      }

      const holding = holdingsMap.get(trade.option_symbol)!

      if (trade.type === 'BUY') {
        holding.totalCost += trade.price * trade.quantity * 100
        holding.quantity += trade.quantity
        holding.avgPrice = holding.totalCost / (holding.quantity * 100)
      } else if (trade.type === 'SELL') {
        const costRemoved = trade.quantity * 100 * holding.avgPrice
        holding.totalCost -= costRemoved
        holding.quantity -= trade.quantity
      }
    }

    return Array.from(holdingsMap.values()).filter((h) => h.quantity > 0)
  }

  async getPortfolios(userId: number) {
    const portfolios = await db('portfolios')
      .join('competitions', 'portfolios.competition_id', 'competitions.id')
      .where({ 'portfolios.user_id': userId })
      .select('portfolios.*', 'competitions.name as competition_name')

    // Fetch trades for all portfolios
    const portfolioIds = portfolios.map((p) => p.id)
    const trades = await db('trades')
      .whereIn('portfolio_id', portfolioIds)
      .orderBy('timestamp', 'asc')

    // Group trades by portfolio
    const tradesByPortfolio = new Map<number, any[]>()
    trades.forEach((trade) => {
      if (!tradesByPortfolio.has(trade.portfolio_id)) {
        tradesByPortfolio.set(trade.portfolio_id, [])
      }
      tradesByPortfolio.get(trade.portfolio_id)!.push(trade)
    })

    // Attach holdings to each portfolio and fetch quotes
    const results = portfolios.map((p) => {
      const pTrades = tradesByPortfolio.get(p.id) || []
      const holdings = this.calculateHoldings(pTrades)
      return { ...p, holdings, trades: pTrades }
    })

    // Batch fetch quotes for all unique holdings across all portfolios
    const allOptionSymbols = new Set<string>()
    const allUnderlyingSymbols = new Set<string>()

    results.forEach((p) =>
      p.holdings.forEach((h: any) => {
        if (h.spreadId && h.longLeg && h.shortLeg) {
          allOptionSymbols.add(h.longLeg.optionSymbol)
          allOptionSymbols.add(h.shortLeg.optionSymbol)
        } else {
          allOptionSymbols.add(h.optionSymbol)
        }
        allUnderlyingSymbols.add(h.symbol)
      }),
    )

    if (allOptionSymbols.size > 0) {
      try {
        const optionQuotesPromise = marketDataService.getQuote(Array.from(allOptionSymbols))
        const underlyingQuotesPromise =
          allUnderlyingSymbols.size > 0
            ? marketDataService.getQuote(Array.from(allUnderlyingSymbols))
            : Promise.resolve([])

        const [quotesArray, underlyingQuotesArray] = await Promise.all([
          optionQuotesPromise,
          underlyingQuotesPromise,
        ])

        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        const underlyingQuotesMap = new Map(
          (Array.isArray(underlyingQuotesArray)
            ? underlyingQuotesArray
            : [underlyingQuotesArray]
          ).map((q: any) => [q.symbol, q]),
        )

        results.forEach((p) => {
          let holdingsValue = 0
          p.holdings.forEach((h: any) => {
            if (h.spreadId && h.longLeg && h.shortLeg) {
              const longQuote = quotesMap.get(h.longLeg.optionSymbol)
              const shortQuote = quotesMap.get(h.shortLeg.optionSymbol)
              if (longQuote && shortQuote) {
                h.longLeg.lastPrice = longQuote.regularMarketPrice
                h.shortLeg.lastPrice = shortQuote.regularMarketPrice
                // Spread value = (Long Value - Short Value)
                const spreadValue =
                  (longQuote.regularMarketPrice - shortQuote.regularMarketPrice) * h.quantity * 100
                h.lastPrice = spreadValue / (h.quantity * 100)
                holdingsValue += spreadValue
              }
            } else {
              const quote = quotesMap.get(h.optionSymbol)
              if (quote) {
                h.lastPrice = quote.regularMarketPrice
                holdingsValue += quote.regularMarketPrice * h.quantity * 100
              }
            }
            const underlyingQuote = underlyingQuotesMap.get(h.symbol)
            if (underlyingQuote) {
              h.underlyingPrice = underlyingQuote.regularMarketPrice
            }
          })

          // Update cached value in DB as well
          const totalValue = Number(p.cash_balance) + holdingsValue
          db('portfolios')
            .where({ id: p.id })
            .update({
              total_value: totalValue,
              last_updated_at: new Date(),
            })
            .catch((err) =>
              console.error(`Failed to background update portfolio ${p.id} value:`, err),
            )
        })
      } catch (error) {
        console.error('Failed to fetch batch quotes for portfolios:', error)
      }
    }

    return results
  }

  async getPortfolio(portfolioId: number) {
    const portfolio = await db('portfolios').where({ id: portfolioId }).first()
    const trades = await db('trades')
      .where({ portfolio_id: portfolioId })
      .orderBy('timestamp', 'asc')

    const holdings = this.calculateHoldings(trades)

    // Fetch quotes for active holdings
    if (holdings.length > 0) {
      try {
        const optionSymbols = holdings.flatMap((h) =>
          h.spreadId && h.longLeg && h.shortLeg
            ? [h.longLeg.optionSymbol, h.shortLeg.optionSymbol]
            : [h.optionSymbol],
        )
        const underlyingSymbols = Array.from(new Set(holdings.map((h) => h.symbol)))

        const optionQuotesPromise = marketDataService.getQuote(optionSymbols)
        const underlyingQuotesPromise = marketDataService.getQuote(underlyingSymbols)

        const [quotesArray, underlyingQuotesArray] = await Promise.all([
          optionQuotesPromise,
          underlyingQuotesPromise,
        ])

        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        const underlyingQuotesMap = new Map(
          (Array.isArray(underlyingQuotesArray)
            ? underlyingQuotesArray
            : [underlyingQuotesArray]
          ).map((q: any) => [q.symbol, q]),
        )

        let holdingsValue = 0
        holdings.forEach((h) => {
          if (h.spreadId && h.longLeg && h.shortLeg) {
            const longQuote = quotesMap.get(h.longLeg.optionSymbol)
            const shortQuote = quotesMap.get(h.shortLeg.optionSymbol)
            if (longQuote && shortQuote) {
              h.longLeg.lastPrice = longQuote.regularMarketPrice
              h.shortLeg.lastPrice = shortQuote.regularMarketPrice
              const spreadValue =
                (longQuote.regularMarketPrice - shortQuote.regularMarketPrice) * h.quantity * 100
              h.lastPrice = spreadValue / (h.quantity * 100)
              holdingsValue += spreadValue
            }
          } else {
            const quote = quotesMap.get(h.optionSymbol)
            if (quote) {
              h.lastPrice = quote.regularMarketPrice
              holdingsValue += quote.regularMarketPrice * h.quantity * 100
            }
          }
          const underlyingQuote = underlyingQuotesMap.get(h.symbol)
          if (underlyingQuote) {
            h.underlyingPrice = underlyingQuote.regularMarketPrice
          }
        })

        // Background update cached value in DB
        const totalValue = Number(portfolio.cash_balance) + holdingsValue
        db('portfolios')
          .where({ id: portfolioId })
          .update({
            total_value: totalValue,
            last_updated_at: new Date(),
          })
          .catch((err) =>
            console.error(`Failed to background update portfolio ${portfolioId} value:`, err),
          )
      } catch (error) {
        console.error(`Failed to fetch quotes for portfolio ${portfolioId}:`, error)
      }
    } else {
      // Background update even if no holdings (just cash)
      db('portfolios')
        .where({ id: portfolioId })
        .update({
          total_value: Number(portfolio.cash_balance),
          last_updated_at: new Date(),
        })
        .catch((err) =>
          console.error(`Failed to background update portfolio ${portfolioId} value:`, err),
        )
    }

    return { ...portfolio, trades, holdings }
  }

  async getPortfolioByCompetition(userId: number, competitionId: number) {
    const portfolio = await db('portfolios')
      .select('portfolios.*', 'competitions.name as competition_name')
      .join('competitions', 'portfolios.competition_id', 'competitions.id')
      .where({ 'portfolios.user_id': userId, 'portfolios.competition_id': competitionId })
      .first()

    if (!portfolio) return null

    const trades = await db('trades')
      .where({ portfolio_id: portfolio.id })
      .orderBy('timestamp', 'asc')

    const holdings = this.calculateHoldings(trades)

    // Fetch quotes for active holdings
    if (holdings.length > 0) {
      try {
        const optionSymbols = holdings.flatMap((h) =>
          h.spreadId && h.longLeg && h.shortLeg
            ? [h.longLeg.optionSymbol, h.shortLeg.optionSymbol]
            : [h.optionSymbol],
        )
        const underlyingSymbols = Array.from(new Set(holdings.map((h) => h.symbol)))

        const optionQuotesPromise = marketDataService.getQuote(optionSymbols)
        const underlyingQuotesPromise = marketDataService.getQuote(underlyingSymbols)

        const [quotesArray, underlyingQuotesArray] = await Promise.all([
          optionQuotesPromise,
          underlyingQuotesPromise,
        ])

        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        const underlyingQuotesMap = new Map(
          (Array.isArray(underlyingQuotesArray)
            ? underlyingQuotesArray
            : [underlyingQuotesArray]
          ).map((q: any) => [q.symbol, q]),
        )

        let holdingsValue = 0
        holdings.forEach((h) => {
          if (h.spreadId && h.longLeg && h.shortLeg) {
            const longQuote = quotesMap.get(h.longLeg.optionSymbol)
            const shortQuote = quotesMap.get(h.shortLeg.optionSymbol)
            if (longQuote && shortQuote) {
              h.longLeg.lastPrice = longQuote.regularMarketPrice
              h.shortLeg.lastPrice = shortQuote.regularMarketPrice
              const spreadValue =
                (longQuote.regularMarketPrice - shortQuote.regularMarketPrice) * h.quantity * 100
              h.lastPrice = spreadValue / (h.quantity * 100)
              holdingsValue += spreadValue
            }
          } else {
            const quote = quotesMap.get(h.optionSymbol)
            if (quote) {
              h.lastPrice = quote.regularMarketPrice
              holdingsValue += (h.lastPrice || 0) * h.quantity * 100
            } else {
              console.warn(`[TradingService] No quote found for holding ${h.optionSymbol}`)
            }
          }
          const underlyingQuote = underlyingQuotesMap.get(h.symbol)
          if (underlyingQuote) {
            h.underlyingPrice = underlyingQuote.regularMarketPrice
          }
        })

        // Background update cached value in DB
        const totalValue = Number(portfolio.cash_balance) + holdingsValue
        console.log(
          `[TradingService] Portfolio ${portfolio.id} Total Value: ${totalValue} (Cash: ${portfolio.cash_balance}, Holdings: ${holdingsValue})`,
        )
        db('portfolios')
          .where({ id: portfolio.id })
          .update({
            total_value: totalValue,
            last_updated_at: new Date(),
          })
          .then(() =>
            console.log(`[TradingService] DB Update SUCCESS for portfolio ${portfolio.id}`),
          )
          .catch((err) =>
            console.error(
              `[TradingService] Failed to background update portfolio ${portfolio.id} value:`,
              err,
            ),
          )
      } catch (error) {
        console.error(`Failed to fetch quotes for portfolio ${portfolio.id}:`, error)
      }
    }

    return { ...portfolio, trades, holdings }
  }

  async updatePortfolioValue(portfolioId: number, trx?: any) {
    const dbInstance = trx || db
    const portfolio = await dbInstance('portfolios').where({ id: portfolioId }).first()
    const trades = await dbInstance('trades').where({ portfolio_id: portfolioId })
    const holdings = this.calculateHoldings(trades)

    let holdingsValue = 0
    if (holdings.length > 0) {
      try {
        const optionSymbols = holdings.flatMap((h) =>
          h.spreadId && h.longLeg && h.shortLeg
            ? [h.longLeg.optionSymbol, h.shortLeg.optionSymbol]
            : [h.optionSymbol],
        )
        const quotesArray = await marketDataService.getQuote(optionSymbols)
        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        holdings.forEach((h) => {
          if (h.spreadId && h.longLeg && h.shortLeg) {
            const longQuote = quotesMap.get(h.longLeg.optionSymbol)
            const shortQuote = quotesMap.get(h.shortLeg.optionSymbol)
            if (longQuote && shortQuote) {
              // Net Value = (Long Price - Short Price) * Qty
              const spreadValue =
                (longQuote.regularMarketPrice - shortQuote.regularMarketPrice) * h.quantity * 100
              holdingsValue += spreadValue
            }
          } else {
            const quote = quotesMap.get(h.optionSymbol)
            if (quote) {
              holdingsValue += quote.regularMarketPrice * h.quantity * 100
            }
          }
        })
      } catch (error) {
        console.error(
          `Failed to fetch quotes for value update in portfolio ${portfolioId}:`,
          error,
        )
      }
    }

    const totalValue = Number(portfolio.cash_balance) + holdingsValue
    await dbInstance('portfolios').where({ id: portfolioId }).update({
      total_value: totalValue,
      last_updated_at: new Date(),
    })

    return totalValue
  }

  async getLeaderboard(competitionId: number, refresh: boolean = false): Promise<any[]> {
    const portfolios = await db('portfolios')
      .join('users', 'portfolios.user_id', 'users.id')
      .where({ competition_id: competitionId })
      .select('portfolios.*', 'users.username')

    if (refresh) {
      // Recalculate all in parallel
      await Promise.all(portfolios.map((p) => this.updatePortfolioValue(p.id)))
      // Re-fetch to get updated values
      return this.getLeaderboard(competitionId, false)
    }

    // Sort by total_value descending
    return portfolios.sort((a, b) => b.total_value - a.total_value)
  }

  async placeSpreadTrade(
    userId: number,
    competitionId: number,
    tradeDetails: {
      symbol: string
      spreadType: 'CALL_DEBIT' | 'PUT_DEBIT'
      longLeg: { optionSymbol: string; strike: number }
      shortLeg: { optionSymbol: string; strike: number }
      quantity: number
    },
  ) {
    if (process.env.NODE_ENV === 'production' && !isMarketOpen()) {
      throw new Error(
        'US Markets are currently closed. Trading is only available 9:30 AM - 4:00 PM ET, Mon-Fri.',
      )
    }

    // Basic Validation
    if (tradeDetails.spreadType === 'CALL_DEBIT') {
      if (tradeDetails.longLeg.strike >= tradeDetails.shortLeg.strike) {
        throw new Error('Call Debit Spread: Buying strike must be lower than selling strike')
      }
    } else if (tradeDetails.spreadType === 'PUT_DEBIT') {
      if (tradeDetails.longLeg.strike <= tradeDetails.shortLeg.strike) {
        throw new Error('Put Debit Spread: Buying strike must be higher than selling strike')
      }
    }

    const trx = await db.transaction()

    try {
      const portfolio = await trx('portfolios')
        .where({ user_id: userId, competition_id: competitionId })
        .first()

      if (!portfolio) throw new Error('Portfolio not found')

      // Get Prices
      let longPrice = 0
      let shortPrice = 0

      try {
        const quotes = await marketDataService.getQuote([
          tradeDetails.longLeg.optionSymbol,
          tradeDetails.shortLeg.optionSymbol,
        ])
        const quotesMap = new Map((quotes as any[]).map((q: any) => [q.symbol, q]))

        const longQuote = quotesMap.get(tradeDetails.longLeg.optionSymbol)
        const shortQuote = quotesMap.get(tradeDetails.shortLeg.optionSymbol)

        if (!longQuote || !shortQuote) throw new Error('Could not fetch needed quotes')

        longPrice = longQuote.regularMarketPrice
        shortPrice = shortQuote.regularMarketPrice
      } catch (e) {
        if (process.env.NODE_ENV === 'test') {
          longPrice = 12.0 // Mock fallback
          shortPrice = 8.0
        } else {
          throw new Error('Could not fetch spread prices')
        }
      }

      // Calculate Net Debit
      // Debit = (Long Ask - Short Bid) ideally, but simplifying to mark/regular price
      const netDebit = (longPrice - shortPrice) * 100 * tradeDetails.quantity

      if (netDebit <= 0) {
        // Unusual but possible with arbitrage or bad data. Allow but warn?
        // For game purposes, let's allow it but ensure min debit?
      }

      if (portfolio.cash_balance < netDebit) {
        throw new Error(`Insufficient funds. Cost: $${netDebit.toFixed(2)}`)
      }

      // Deduct Cash
      await trx('portfolios').where({ id: portfolio.id }).decrement('cash_balance', netDebit)

      const spreadId = short.generate()

      // Insert Long Leg (BUY)
      await trx('trades').insert({
        portfolio_id: portfolio.id,
        symbol: tradeDetails.symbol,
        option_symbol: tradeDetails.longLeg.optionSymbol,
        type: 'BUY',
        side: tradeDetails.spreadType === 'CALL_DEBIT' ? 'CALL' : 'PUT',
        quantity: tradeDetails.quantity,
        price: longPrice,
        timestamp: new Date(),
        spread_id: spreadId,
        expiration_date: this.parseExpirationDate(tradeDetails.longLeg.optionSymbol),
      })

      // Insert Short Leg (SELL)
      await trx('trades').insert({
        portfolio_id: portfolio.id,
        symbol: tradeDetails.symbol,
        option_symbol: tradeDetails.shortLeg.optionSymbol,
        type: 'SELL',
        side: tradeDetails.spreadType === 'CALL_DEBIT' ? 'CALL' : 'PUT',
        quantity: tradeDetails.quantity,
        price: shortPrice,
        timestamp: new Date(),
        spread_id: spreadId,
        expiration_date: this.parseExpirationDate(tradeDetails.shortLeg.optionSymbol),
      })

      const newTotalValue = await this.updatePortfolioValue(portfolio.id, trx)
      await trx.commit()

      return { spreadId, netDebit, newTotalValue }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  async closeSpreadTrade(userId: number, spreadId: string) {
    if (process.env.NODE_ENV === 'production' && !isMarketOpen()) {
      throw new Error('Market Closed')
    }

    const trx = await db.transaction()

    try {
      // Find open trades for this spread
      // We need to verify we still hold them.
      // Easiest is to fetch all trades for this spreadId, calculate net quantity remaining
      // For now, assume simple "Buy once, Sell once" model or "Holdings" calculation model
      // But we can simplify: check if there are any open positions for this spread ID for this user.
      // Actually, we must check ownership.

      // Get trades with this spread_id for a portfolio owned by user
      const spreadTrades = await trx('trades')
        .join('portfolios', 'trades.portfolio_id', 'portfolios.id')
        .where({ 'trades.spread_id': spreadId, 'portfolios.user_id': userId })
        .select('trades.*', 'portfolios.id as portfolio_id', 'portfolios.cash_balance')

      if (spreadTrades.length === 0) throw new Error('Spread not found or no access')

      const portfolioId = spreadTrades[0].portfolio_id
      const cashBalance = spreadTrades[0].cash_balance

      // Calculate integrity: sum of quantities per option symbol
      // If sum is 0, it's already closed.
      const legMap = new Map<string, { type: string; quantity: number }>()

      for (const t of spreadTrades) {
        if (!legMap.has(t.option_symbol)) {
          legMap.set(t.option_symbol, { type: '', quantity: 0 })
        }
        const leg = legMap.get(t.option_symbol)!
        if (t.type === 'BUY') leg.quantity += t.quantity
        if (t.type === 'SELL') leg.quantity -= t.quantity
      }

      // Check if we have open quantity
      // A valid open spread should have +Qty on Long leg and -Qty on Short leg?
      // Wait, in my `calculateHoldings`, Short leg is just tracked.
      // The trades table stores Short leg as TYPE='SELL'.
      // So Long Leg Balance = +Qty, Short Leg Balance = -Qty.
      // To CLOSE, we need to SELL the Long Leg and BUY the Short Leg.

      let longLegSymbol = ''
      let shortLegSymbol = ''
      let quantityToClose = 0

      legMap.forEach((val, key) => {
        if (val.quantity > 0) {
          longLegSymbol = key
          quantityToClose = val.quantity
        } else if (val.quantity < 0) {
          shortLegSymbol = key
        }
      })

      if (!longLegSymbol || !shortLegSymbol || quantityToClose === 0) {
        throw new Error('Spread is already closed or invalid state')
      }

      // Get current prices
      let longPrice = 0
      let shortPrice = 0
      try {
        const quotes = await marketDataService.getQuote([longLegSymbol, shortLegSymbol])
        const quotesMap = new Map((quotes as any[]).map((q: any) => [q.symbol, q]))
        longPrice = quotesMap.get(longLegSymbol).regularMarketPrice
        shortPrice = quotesMap.get(shortLegSymbol).regularMarketPrice
      } catch (e) {
        if (process.env.NODE_ENV === 'test') {
          longPrice = 13.0
          shortPrice = 7.0
        } else {
          throw new Error('Could not fetch prices to close spread')
        }
      }

      // Net Credit = (Long Sell Price - Short Buy Price)
      const netCredit = (longPrice - shortPrice) * quantityToClose * 100

      // Insert Closing Trades
      // Sell Long Leg
      await trx('trades').insert({
        portfolio_id: portfolioId,
        symbol: spreadTrades[0].symbol, // Underlying same
        option_symbol: longLegSymbol,
        type: 'SELL',
        side: spreadTrades[0].side, // CALL or PUT
        quantity: quantityToClose,
        price: longPrice,
        timestamp: new Date(),
        spread_id: spreadId,
        expiration_date: this.parseExpirationDate(longLegSymbol),
      })

      // Buy Short Leg
      await trx('trades').insert({
        portfolio_id: portfolioId,
        symbol: spreadTrades[0].symbol,
        option_symbol: shortLegSymbol,
        type: 'BUY',
        side: spreadTrades[0].side,
        quantity: quantityToClose,
        price: shortPrice,
        timestamp: new Date(),
        spread_id: spreadId,
        expiration_date: this.parseExpirationDate(shortLegSymbol),
      })

      // Update Cash (Add Credit)
      await trx('portfolios').where({ id: portfolioId }).increment('cash_balance', netCredit)

      const newTotalValue = await this.updatePortfolioValue(portfolioId, trx)
      await trx.commit()

      return { netCredit, newTotalValue }
    } catch (e) {
      await trx.rollback()
      throw e
    }
  }

  private parseExpirationDate(optionSymbol: string): string | null {
    const match = optionSymbol.match(/[A-Z]+(\d{6})[CP]\d{8}/)
    if (match) {
      const dateStr = match[1] // YYMMDD
      const year = '20' + dateStr.substring(0, 2)
      const month = dateStr.substring(2, 4)
      const day = dateStr.substring(4, 6)
      return `${year}-${month}-${day}`
    }
    return null
  }

  async placeTrade(
    userId: number,
    competitionId: number,
    tradeDetails: {
      symbol: string
      optionSymbol: string
      type: 'BUY' | 'SELL'
      side: 'CALL' | 'PUT'
      quantity: number
    },
  ) {
    return this.placeTradeInternal(userId, competitionId, tradeDetails)
  }

  // Renaming original placeTrade to internal to reuse logic if needed,
  // but for now keeping it as is to avoid breaking changes, just adding helper if wanted.
  // Actually, I'll keep the original placeTrade implementation logic here but wrapped.
  // ... wait, I'm replacing the whole method in the tool call. I should just keep it or preserve as is.
  // I will just paste the original placeTrade method back to ensure no regression,
  // making use of the new helper parseExpirationDate if I want, but let's stick to minimal changes.

  private async placeTradeInternal(
    userId: number,
    competitionId: number,
    tradeDetails: {
      symbol: string
      optionSymbol: string
      type: 'BUY' | 'SELL'
      side: 'CALL' | 'PUT'
      quantity: number
    },
  ) {
    // 0. Enforce Market Hours
    if (process.env.NODE_ENV === 'production' && !isMarketOpen()) {
      throw new Error(
        'US Markets are currently closed. Trading is only available 9:30 AM - 4:00 PM ET, Mon-Fri.',
      )
    }

    const trx = await db.transaction()

    try {
      // 1. Validate Portfolio Access
      const portfolio = await trx('portfolios')
        .where({ user_id: userId, competition_id: competitionId })
        .first()

      if (!portfolio) {
        throw new Error('Portfolio not found or user not in competition')
      }

      // 2. Get Real-time Price
      let price = 0

      try {
        // Fetch quote directly for the option symbol
        const quote = (await marketDataService.getQuote(tradeDetails.optionSymbol)) as any
        price = quote.regularMarketPrice
      } catch (e) {
        if (process.env.NODE_ENV === 'test') {
          price = 10.0 // Mock price for testing
        } else {
          throw new Error(`Could not fetch price for ${tradeDetails.optionSymbol}`)
        }
      }

      const totalCost = price * tradeDetails.quantity * 100 // Options are 100 shares

      // 3. Update Balance (Buying decreases cash, Selling increases cash - simplified)
      // Note: Selling to Open (writing) requires margin, Selling to Close requires holding.
      // MVP: Only Buy to Open and Sell to Close (Long positions only).
      // TODO: Enforce "Net Long" or simple position tracking.

      // For MVP: Simple cash check for BUY.
      // For SELL: Check if we have quantity.

      // Re-calculate current holdings to validate sell
      const allTrades = await trx('trades').where({
        portfolio_id: portfolio.id,
        option_symbol: tradeDetails.optionSymbol,
      })
      let currentQuantity = 0
      for (const t of allTrades) {
        if (t.type === 'BUY') currentQuantity += t.quantity
        if (t.type === 'SELL') currentQuantity -= t.quantity
      }

      if (tradeDetails.type === 'BUY') {
        if (portfolio.cash_balance < totalCost) {
          throw new Error('Insufficient funds')
        }
        await trx('portfolios').where({ id: portfolio.id }).decrement('cash_balance', totalCost)
      } else if (tradeDetails.type === 'SELL') {
        if (currentQuantity < tradeDetails.quantity) {
          throw new Error('Insufficient position to sell')
        }
        await trx('portfolios').where({ id: portfolio.id }).increment('cash_balance', totalCost)
      }

      // Parse expiration date from option symbol
      const expirationDate = this.parseExpirationDate(tradeDetails.optionSymbol)

      // 4. Record Trade
      const [trade] = await trx('trades')
        .insert({
          portfolio_id: portfolio.id,
          symbol: tradeDetails.symbol,
          option_symbol: tradeDetails.optionSymbol,
          type: tradeDetails.type,
          side: tradeDetails.side,
          quantity: tradeDetails.quantity,
          price: price,
          timestamp: new Date(),
          expiration_date: expirationDate,
        })
        .returning('*')

      // 5. Update cached portfolio value
      const newTotalValue = await this.updatePortfolioValue(portfolio.id, trx)

      await trx.commit()
      return {
        trade,
        newBalance:
          tradeDetails.type === 'BUY'
            ? portfolio.cash_balance - totalCost
            : portfolio.cash_balance + totalCost,
        newTotalValue,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  async saveTrade(
    userId: number,
    competitionId: number,
    tradeDetails: {
      symbol: string
      optionSymbol: string
      type: 'BUY' | 'SELL'
      side: 'CALL' | 'PUT'
      quantity: number
      strikePrice: number
      expirationDate: number
      note: string | null
    },
  ) {
    // Validate portfolio access
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()

    if (!portfolio) {
      throw new Error('Portfolio not found or user not in competition')
    }

    // Save the trade
    const [savedTrade] = await db('saved_trades')
      .insert({
        portfolio_id: portfolio.id,
        symbol: tradeDetails.symbol,
        option_symbol: tradeDetails.optionSymbol,
        type: tradeDetails.type,
        side: tradeDetails.side,
        quantity: tradeDetails.quantity,
        strike_price: tradeDetails.strikePrice,
        expiration_date: tradeDetails.expirationDate,
        note: tradeDetails.note,
      })
      .returning('*')

    return savedTrade
  }

  async getSavedTrades(userId: number, competitionId: number) {
    // Get portfolio for this user and competition
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()

    if (!portfolio) {
      return []
    }

    // Fetch saved trades
    const savedTrades = await db('saved_trades')
      .where({ portfolio_id: portfolio.id })
      .orderBy('created_at', 'desc')

    return savedTrades
  }

  async deleteSavedTrade(userId: number, savedTradeId: number) {
    // Verify ownership
    const savedTrade = await db('saved_trades')
      .join('portfolios', 'saved_trades.portfolio_id', 'portfolios.id')
      .where({ 'saved_trades.id': savedTradeId, 'portfolios.user_id': userId })
      .first()

    if (!savedTrade) {
      throw new Error('Saved trade not found or unauthorized')
    }

    await db('saved_trades').where({ id: savedTradeId }).delete()
  }

  async executeSavedTrade(userId: number, savedTradeId: number) {
    // Fetch saved trade with ownership check
    const savedTrade = await db('saved_trades')
      .join('portfolios', 'saved_trades.portfolio_id', 'portfolios.id')
      .where({ 'saved_trades.id': savedTradeId, 'portfolios.user_id': userId })
      .select('saved_trades.*', 'portfolios.competition_id')
      .first()

    if (!savedTrade) {
      throw new Error('Saved trade not found or unauthorized')
    }

    // Execute the trade using existing placeTrade logic
    const result = await this.placeTrade(userId, savedTrade.competition_id, {
      symbol: savedTrade.symbol,
      optionSymbol: savedTrade.option_symbol,
      type: savedTrade.type,
      side: savedTrade.side,
      quantity: savedTrade.quantity,
    })

    // Delete the saved trade after successful execution
    await db('saved_trades').where({ id: savedTradeId }).delete()

    return result
  }
}

export default new TradingService()
