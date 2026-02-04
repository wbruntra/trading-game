import db from '@/config/db'
import marketDataService from '@/services/marketDataService'
import { isMarketOpen } from '@/utils/marketHours'

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
      }
    >()

    for (const trade of trades) {
      if (!holdingsMap.has(trade.option_symbol)) {
        // Parse strike from option symbol (e.g., AAPL260204C00250000)
        // Format: Symbol (variable) + YYMMDD + C/P + Strike (8 digits, implied 3 decimals? No, usually 1/1000th)
        // Standard OCC: 6 digits date, 1 digit type, 8 digits strike (integer, div by 1000)
        const match = trade.option_symbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
        let strike = 0
        let expirationDate = ''
        if (match) {
          expirationDate = match[2] // YYMMDD
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
    results.forEach((p) => p.holdings.forEach((h: any) => allOptionSymbols.add(h.optionSymbol)))

    if (allOptionSymbols.size > 0) {
      try {
        const quotesArray = await marketDataService.getQuote(Array.from(allOptionSymbols))
        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        results.forEach((p) => {
          let holdingsValue = 0
          p.holdings.forEach((h: any) => {
            const quote = quotesMap.get(h.optionSymbol)
            if (quote) {
              h.lastPrice = quote.regularMarketPrice
              holdingsValue += quote.regularMarketPrice * h.quantity * 100
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
        const optionSymbols = holdings.map((h) => h.optionSymbol)
        const quotesArray = await marketDataService.getQuote(optionSymbols)
        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        let holdingsValue = 0
        holdings.forEach((h) => {
          const quote = quotesMap.get(h.optionSymbol)
          if (quote) {
            h.lastPrice = quote.regularMarketPrice
            holdingsValue += quote.regularMarketPrice * h.quantity * 100
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
        const optionSymbols = holdings.map((h) => h.optionSymbol)
        const quotesArray = await marketDataService.getQuote(optionSymbols)
        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        let holdingsValue = 0
        holdings.forEach((h) => {
          const quote = quotesMap.get(h.optionSymbol)
          if (quote) {
            h.lastPrice = quote.regularMarketPrice
            holdingsValue += quote.regularMarketPrice * h.quantity * 100
          }
        })

        // Background update cached value in DB
        const totalValue = Number(portfolio.cash_balance) + holdingsValue
        db('portfolios')
          .where({ id: portfolio.id })
          .update({
            total_value: totalValue,
            last_updated_at: new Date(),
          })
          .catch((err) =>
            console.error(`Failed to background update portfolio ${portfolio.id} value:`, err),
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
        const optionSymbols = holdings.map((h) => h.optionSymbol)
        const quotesArray = await marketDataService.getQuote(optionSymbols)
        const quotesMap = new Map(
          (Array.isArray(quotesArray) ? quotesArray : [quotesArray]).map((q: any) => [
            q.symbol,
            q,
          ]),
        )

        holdings.forEach((h) => {
          const quote = quotesMap.get(h.optionSymbol)
          if (quote) {
            holdingsValue += quote.regularMarketPrice * h.quantity * 100
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
    // 0. Enforce Market Hours
    if (process.env.NODE_ENV !== 'test' && !isMarketOpen()) {
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
