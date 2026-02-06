import db from '@/config/db'
import marketDataService from '@/services/marketDataService'
import { isMarketOpen } from '@/utils/marketHours'
import short from 'short-uuid'

export class TradingService {
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

  // Format Helpers
  private formatHoldingRow(row: any) {
    const match = row.option_symbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
    let strike = 0
    let expirationDate = ''
    if (match) {
      expirationDate = match[2]
      strike = parseInt(match[4], 10) / 1000
    }

    return {
      symbol: row.symbol,
      optionSymbol: row.option_symbol,
      side: row.side,
      quantity: row.quantity,
      totalCost: Number(row.cost_basis),
      avgPrice: Number(row.cost_basis) / (row.quantity * 100),
      strike,
      expirationDate,
      lastPrice: 0,
    }
  }

  private formatSpreadHolding(longRow: any, shortRow: any) {
    const spreadType = longRow.side === 'CALL' ? 'CALL_DEBIT' : 'PUT_DEBIT'
    const quantity = longRow.quantity

    // Net Cost = Long Cost Basis + Short Cost Basis (which is negative)
    const totalCost = Number(longRow.cost_basis) + Number(shortRow.cost_basis)

    const longLeg = {
      optionSymbol: longRow.option_symbol,
      avgPrice: Number(longRow.cost_basis) / (longRow.quantity * 100),
      strike: 0,
    }
    const shortLeg = {
      optionSymbol: shortRow.option_symbol,
      avgPrice: -Number(shortRow.cost_basis) / (quantity * 100), // Original Sell Price
      strike: 0,
    }

    // Parse strikes
    const longMatch = longLeg.optionSymbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
    if (longMatch) longLeg.strike = parseInt(longMatch[4], 10) / 1000

    const shortMatch = shortLeg.optionSymbol.match(/([A-Z]+)(\d{6})([CP])(\d{8})/)
    if (shortMatch) shortLeg.strike = parseInt(shortMatch[4], 10) / 1000

    // Get Expiration from Long Leg
    let expirationDate = ''
    if (longMatch) expirationDate = longMatch[2]

    return {
      symbol: longRow.symbol, // Underlying
      optionSymbol: `${longRow.symbol} ${spreadType === 'CALL_DEBIT' ? 'Call' : 'Put'} Spread`,
      side: longRow.side,
      quantity,
      totalCost,
      avgPrice: totalCost / (quantity * 100),
      strike: longLeg.strike,
      expirationDate,
      spreadId: longRow.spread_id,
      spreadType,
      longLeg,
      shortLeg,
    }
  }

  async getPortfolios(userId: number) {
    const portfolios = await db('portfolios')
      .join('competitions', 'portfolios.competition_id', 'competitions.id')
      .where({ 'portfolios.user_id': userId })
      .select('portfolios.*', 'competitions.name as competition_name')

    // Fetch trades for all portfolios (legacy support/display)
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

    // Fetch holdings from DB
    const dbHoldings = await db('holdings').whereIn('portfolio_id', portfolioIds)

    const holdingsByPortfolio = new Map<number, any[]>()
    const spreadMap = new Map<string, any[]>()

    dbHoldings.forEach((h: any) => {
      if (h.spread_id) {
        const key = `${h.portfolio_id}:${h.spread_id}`
        if (!spreadMap.has(key)) spreadMap.set(key, [])
        spreadMap.get(key)!.push(h)
      } else {
        if (!holdingsByPortfolio.has(h.portfolio_id)) holdingsByPortfolio.set(h.portfolio_id, [])
        holdingsByPortfolio.get(h.portfolio_id)!.push(this.formatHoldingRow(h))
      }
    })

    spreadMap.forEach((legs) => {
      if (legs.length !== 2) return
      const longLeg = legs.find((l) => l.quantity > 0)
      const shortLeg = legs.find((l) => l.quantity < 0)

      if (!longLeg || !shortLeg) return

      const reconstructed = this.formatSpreadHolding(longLeg, shortLeg)
      if (!holdingsByPortfolio.has(longLeg.portfolio_id))
        holdingsByPortfolio.set(longLeg.portfolio_id, [])
      holdingsByPortfolio.get(longLeg.portfolio_id)!.push(reconstructed)
    })

    const results = portfolios.map((p) => {
      const pTrades = tradesByPortfolio.get(p.id) || []
      const pHoldings = holdingsByPortfolio.get(p.id) || []
      return { ...p, holdings: pHoldings, trades: pTrades }
    })

    // Batch fetch quotes
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
              h.underlyingChange = underlyingQuote.regularMarketChange
              h.underlyingChangePercent = underlyingQuote.regularMarketChangePercent
            }
          })

          const totalValue = Number(p.cash_balance) + holdingsValue
          db('portfolios')
            .where({ id: p.id })
            .update({ total_value: totalValue, last_updated_at: new Date() })
            .catch(console.error)
        })
      } catch (error) {
        console.error('Failed to fetch batch quotes for portfolios:', error)
      }
    }

    return results
  }

  async getPortfolio(portfolioId: number) {
    const portfolio = await db('portfolios')
      .join('competitions', 'portfolios.competition_id', 'competitions.id')
      .where({ 'portfolios.id': portfolioId })
      .select('portfolios.*', 'competitions.initial_balance')
      .first()
    const trades = await db('trades')
      .where({ portfolio_id: portfolioId })
      .orderBy('timestamp', 'asc')

    // Fetch holdings from DB
    const dbHoldings = await db('holdings').where({ portfolio_id: portfolioId })
    const holdings: any[] = []

    // Group spreads
    const spreadMap = new Map<string, any[]>()

    dbHoldings.forEach((h: any) => {
      if (h.spread_id) {
        if (!spreadMap.has(h.spread_id)) spreadMap.set(h.spread_id, [])
        spreadMap.get(h.spread_id)!.push(h)
      } else {
        holdings.push(this.formatHoldingRow(h))
      }
    })

    spreadMap.forEach((legs) => {
      const longLeg = legs.find((l) => l.quantity > 0)
      const shortLeg = legs.find((l) => l.quantity < 0)
      if (longLeg && shortLeg) {
        holdings.push(this.formatSpreadHolding(longLeg, shortLeg))
      }
    })

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
            }
          }
          const underlyingQuote = underlyingQuotesMap.get(h.symbol)
          if (underlyingQuote) {
            h.underlyingPrice = underlyingQuote.regularMarketPrice
            h.underlyingChange = underlyingQuote.regularMarketChange
            h.underlyingChangePercent = underlyingQuote.regularMarketChangePercent
          }
        })

        const totalValue = Number(portfolio.cash_balance) + holdingsValue
        db('portfolios')
          .where({ id: portfolio.id })
          .update({ total_value: totalValue, last_updated_at: new Date() })
          .catch(console.error)
      } catch (error) {
        console.error(`Failed to fetch quotes for portfolio ${portfolio.id}:`, error)
      }
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

    // Reuse getPortfolio logic but we already have the portfolio object
    // Keep it simple and just redirect to getPortfolio or duplicate the logic for now
    return this.getPortfolio(portfolio.id)
  }

  async updatePortfolioValue(portfolioId: number, trx?: any) {
    const dbInstance = trx || db
    const portfolio = await dbInstance('portfolios').where({ id: portfolioId }).first()
    const dbHoldings = await dbInstance('holdings').where({ portfolio_id: portfolioId })

    const holdings: any[] = []
    const spreadMap = new Map<string, any[]>()
    dbHoldings.forEach((h: any) => {
      if (h.spread_id) {
        if (!spreadMap.has(h.spread_id)) spreadMap.set(h.spread_id, [])
        spreadMap.get(h.spread_id)!.push(h)
      } else {
        holdings.push(this.formatHoldingRow(h))
      }
    })
    spreadMap.forEach((legs: any[]) => {
      const longLeg = legs.find((l) => l.quantity > 0)
      const shortLeg = legs.find((l) => l.quantity < 0)
      if (longLeg && shortLeg) {
        holdings.push(this.formatSpreadHolding(longLeg, shortLeg))
      }
    })

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
      await Promise.all(portfolios.map((p) => this.updatePortfolioValue(p.id)))
      return this.getLeaderboard(competitionId, false)
    }

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
          longPrice = 12.0
          shortPrice = 8.0
        } else {
          throw new Error('Could not fetch spread prices')
        }
      }

      const netDebit = (longPrice - shortPrice) * 100 * tradeDetails.quantity

      if (netDebit <= 0) {
        throw new Error(
          'Invalid spread: Would result in a credit to your account. Market data may be stale.',
        )
      }

      if (portfolio.cash_balance < netDebit) {
        throw new Error(`Insufficient funds. Cost: $${netDebit.toFixed(2)}`)
      }

      await trx('portfolios').where({ id: portfolio.id }).decrement('cash_balance', netDebit)

      const spreadId = short.generate()

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

      await trx('holdings').insert([
        {
          portfolio_id: portfolio.id,
          symbol: tradeDetails.symbol,
          option_symbol: tradeDetails.longLeg.optionSymbol,
          side: tradeDetails.spreadType === 'CALL_DEBIT' ? 'CALL' : 'PUT',
          quantity: tradeDetails.quantity,
          cost_basis: longPrice * tradeDetails.quantity * 100,
          spread_id: spreadId,
        },
        {
          portfolio_id: portfolio.id,
          symbol: tradeDetails.symbol,
          option_symbol: tradeDetails.shortLeg.optionSymbol,
          side: tradeDetails.spreadType === 'CALL_DEBIT' ? 'CALL' : 'PUT',
          quantity: -tradeDetails.quantity,
          cost_basis: -shortPrice * tradeDetails.quantity * 100,
          spread_id: spreadId,
        },
      ])

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
      const spreadTrades = await trx('trades')
        .join('portfolios', 'trades.portfolio_id', 'portfolios.id')
        .where({ 'trades.spread_id': spreadId, 'portfolios.user_id': userId })
        .select('trades.*', 'portfolios.id as portfolio_id', 'portfolios.cash_balance')

      if (spreadTrades.length === 0) throw new Error('Spread not found or no access')

      const portfolioId = spreadTrades[0].portfolio_id

      const holdings = await trx('holdings').where({
        spread_id: spreadId,
        portfolio_id: portfolioId,
      })

      if (holdings.length !== 2) throw new Error('Spread not found active in holdings')

      const longLeg = holdings.find((h) => h.quantity > 0)
      const shortLeg = holdings.find((h) => h.quantity < 0)

      if (!longLeg || !shortLeg) throw new Error('Invalid spread state')

      const quantityToClose = longLeg.quantity
      const longLegSymbol = longLeg.option_symbol
      const shortLegSymbol = shortLeg.option_symbol

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

      const netCredit = (longPrice - shortPrice) * quantityToClose * 100

      if (netCredit < 0) {
        throw new Error(
          'Invalid spread close: Would result in a debit to close the position. Market data may be stale.',
        )
      }

      await trx('trades').insert({
        portfolio_id: portfolioId,
        symbol: spreadTrades[0].symbol,
        option_symbol: longLegSymbol,
        type: 'SELL',
        side: spreadTrades[0].side,
        quantity: quantityToClose,
        price: longPrice,
        timestamp: new Date(),
        spread_id: spreadId,
        expiration_date: this.parseExpirationDate(longLegSymbol),
      })

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

      await trx('holdings').where({ spread_id: spreadId }).del()

      await trx('portfolios').where({ id: portfolioId }).increment('cash_balance', netCredit)

      const newTotalValue = await this.updatePortfolioValue(portfolioId, trx)
      await trx.commit()

      return { netCredit, newTotalValue }
    } catch (e) {
      await trx.rollback()
      throw e
    }
  }

  async snapshotAllPortfolios() {
    console.log('[TradingService] Starting portfolio value snapshot...')
    const trx = await db.transaction()

    try {
      const portfolios = await trx('portfolios')
        .join('competitions', 'portfolios.competition_id', 'competitions.id')
        .where('competitions.status', 'active')
        .select('portfolios.*')

      if (portfolios.length === 0) {
        console.log('[TradingService] No active portfolios to snapshot.')
        await trx.commit()
        return { message: 'No active portfolios' }
      }

      const portfolioIds = portfolios.map((p) => p.id)
      const dbHoldings = await trx('holdings').whereIn('portfolio_id', portfolioIds)

      const allOptionSymbols = new Set<string>()
      const allUnderlyingSymbols = new Set<string>()
      const portfolioHoldings = new Map<number, any[]>()
      const spreadMap = new Map<string, any[]>()

      dbHoldings.forEach((h: any) => {
        if (!portfolioHoldings.has(h.portfolio_id)) portfolioHoldings.set(h.portfolio_id, [])

        if (h.spread_id) {
          let pSpreads = spreadMap.get(h.portfolio_id + '_' + h.spread_id)
          if (!pSpreads) {
            pSpreads = []
            spreadMap.set(h.portfolio_id + '_' + h.spread_id, pSpreads)
          }
          pSpreads.push(h)
        } else {
          const formatted = this.formatHoldingRow(h)
          portfolioHoldings.get(h.portfolio_id)!.push(formatted)
          allOptionSymbols.add(formatted.optionSymbol)
          allUnderlyingSymbols.add(formatted.symbol)
        }
      })

      spreadMap.forEach((legs, key) => {
        const [pIdStr] = key.split('_')
        const pId = Number(pIdStr)

        const longLeg = legs.find((l) => l.quantity > 0)
        const shortLeg = legs.find((l) => l.quantity < 0)

        if (longLeg && shortLeg) {
          const formatted = this.formatSpreadHolding(longLeg, shortLeg)
          portfolioHoldings.get(pId)?.push(formatted)

          allOptionSymbols.add(formatted.longLeg.optionSymbol)
          allOptionSymbols.add(formatted.shortLeg.optionSymbol)
          allUnderlyingSymbols.add(formatted.symbol)
        }
      })

      const symbolsToFetch = [...allOptionSymbols, ...allUnderlyingSymbols]
      const quotesMap = new Map<string, any>()

      if (symbolsToFetch.length > 0) {
        try {
          const quotes = await marketDataService.getQuote(symbolsToFetch)
          const quotesArray = Array.isArray(quotes) ? quotes : [quotes]
          quotesArray.forEach((q: any) => {
            if (q && q.symbol) quotesMap.set(q.symbol, q)
          })
        } catch (e) {
          console.error('[TradingService] Error fetching batch quotes for snapshot:', e)
        }
      }

      const historyInserts: any[] = []

      for (const p of portfolios) {
        const holdings = portfolioHoldings.get(p.id) || []
        let holdingsValue = 0

        holdings.forEach((h: any) => {
          if (h.spreadId && h.longLeg && h.shortLeg) {
            const longQuote = quotesMap.get(h.longLeg.optionSymbol)
            const shortQuote = quotesMap.get(h.shortLeg.optionSymbol)
            if (longQuote && shortQuote) {
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

        const totalValue = Number(p.cash_balance) + holdingsValue

        historyInserts.push({
          portfolio_id: p.id,
          total_value: totalValue,
          cash_balance: Number(p.cash_balance),
          timestamp: new Date(),
        })

        await trx('portfolios').where({ id: p.id }).update({
          total_value: totalValue,
          last_updated_at: new Date(),
        })
      }

      if (historyInserts.length > 0) {
        await trx('portfolio_history').insert(historyInserts)
      }

      await trx.commit()
      console.log(
        `[TradingService] Snapshot complete. Updated ${historyInserts.length} portfolios.`,
      )
      return { success: true, count: historyInserts.length }
    } catch (error) {
      await trx.rollback()
      console.error('[TradingService] Snapshot failed:', error)
      throw error
    }
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
      strikePrice?: number
      expirationDate?: number
      note?: string | null
    },
  ) {
    if (process.env.NODE_ENV === 'production' && !isMarketOpen()) {
      throw new Error(
        'US Markets are currently closed. Trading is only available 9:30 AM - 4:00 PM ET, Mon-Fri.',
      )
    }

    const trx = await db.transaction()

    try {
      const portfolio = await trx('portfolios')
        .where({ user_id: userId, competition_id: competitionId })
        .first()

      if (!portfolio) throw new Error('Portfolio not found')

      let price = 0
      try {
        const quote = await marketDataService.getQuote(tradeDetails.optionSymbol)
        price = quote.regularMarketPrice
      } catch (e) {
        if (process.env.NODE_ENV === 'test') {
          price = 10.5
        } else {
          throw new Error('Could not fetch option price')
        }
      }

      const cost = price * tradeDetails.quantity * 100

      if (tradeDetails.type === 'BUY') {
        if (portfolio.cash_balance < cost) {
          throw new Error(`Insufficient funds. Cost: $${cost.toFixed(2)}`)
        }

        const existingHolding = await trx('holdings')
          .where({ portfolio_id: portfolio.id, option_symbol: tradeDetails.optionSymbol })
          .first()

        if (existingHolding) {
          const newQuantity = existingHolding.quantity + tradeDetails.quantity
          const newCostBasis =
            Number(existingHolding.cost_basis) + price * tradeDetails.quantity * 100

          await trx('holdings').where({ id: existingHolding.id }).update({
            quantity: newQuantity,
            cost_basis: newCostBasis,
            updated_at: new Date(),
          })
        } else {
          await trx('holdings').insert({
            portfolio_id: portfolio.id,
            symbol: tradeDetails.symbol,
            option_symbol: tradeDetails.optionSymbol,
            side: tradeDetails.side,
            quantity: tradeDetails.quantity,
            cost_basis: cost,
            spread_id: null,
          })
        }

        await trx('portfolios').where({ id: portfolio.id }).decrement('cash_balance', cost)
      } else {
        // SELL
        const existingHolding = await trx('holdings')
          .where({ portfolio_id: portfolio.id, option_symbol: tradeDetails.optionSymbol })
          .first()

        // We only verify "Standard" holdings (non-spread) for now, or just check net quantity?
        // If it's part of a spread, usage of 'placeTrade' might be dangerous if not strictly controlled.
        // Assuming 'placeTrade' is for individual ISO trades.
        // If user holds a spread, and tries to sell one leg, what happens?
        // They might effectively "Leg out" of the spread.
        // If we allow breaking spreads, we should support it.
        // But our holdings table tracks spread_id.
        // If they sell a leg that is part of a spread, we should probably update that spread logic?
        // Complexity: Keeping it simple. We only allow selling if we have sufficient quantity in 'holdings'
        // ignoring spread_id constraints for checking availability, BUT we need to debit the correct row.
        // If we have multiple rows (some in spread, some not), which one do we sell?
        // Prefer selling "free" holdings first?
        // This is getting complex.
        // Simplifying MVP:
        // Check TOTAL quantity across all rows for this option_symbol.

        const allHoldings = await trx('holdings').where({
          portfolio_id: portfolio.id,
          option_symbol: tradeDetails.optionSymbol,
        })
        const totalHeld = allHoldings.reduce((sum, h) => sum + h.quantity, 0)

        if (totalHeld < tradeDetails.quantity) {
          throw new Error('Insufficient position to sell')
        }

        // FIFO or Pro-rata?
        // We iterate and reduce.
        let remainingToSell = tradeDetails.quantity

        for (const h of allHoldings) {
          if (remainingToSell <= 0) break
          if (h.quantity <= 0) continue // Should be positive for Long holdings

          const amountFromThis = Math.min(h.quantity, remainingToSell)

          // Cost Basis Reduction (Average Cost for this specific lot)
          const costPerUnit = Number(h.cost_basis) / h.quantity
          const basisRecouped = costPerUnit * amountFromThis

          const newQty = h.quantity - amountFromThis
          const newBasis = Number(h.cost_basis) - basisRecouped

          if (newQty === 0) {
            await trx('holdings').where({ id: h.id }).del()
          } else {
            await trx('holdings').where({ id: h.id }).update({
              quantity: newQty,
              cost_basis: newBasis,
              updated_at: new Date(),
            })
          }

          remainingToSell -= amountFromThis
        }

        await trx('portfolios').where({ id: portfolio.id }).increment('cash_balance', cost)
      }

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
          expiration_date: this.parseExpirationDate(tradeDetails.optionSymbol),
        })
        .returning('*')

      const newTotalValue = await this.updatePortfolioValue(portfolio.id, trx)
      await trx.commit()

      return {
        trade: { ...tradeDetails, price, id: trade.id },
        newBalance: newTotalValue,
      }
    } catch (error) {
      await trx.rollback()
      console.error(error)
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
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()

    if (!portfolio) {
      throw new Error('Portfolio not found or user not in competition')
    }

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
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()

    if (!portfolio) {
      return []
    }

    const savedTrades = await db('saved_trades')
      .where({ portfolio_id: portfolio.id })
      .orderBy('created_at', 'desc')

    return savedTrades
  }

  async deleteSavedTrade(userId: number, savedTradeId: number) {
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
    const savedTrade = await db('saved_trades')
      .join('portfolios', 'saved_trades.portfolio_id', 'portfolios.id')
      .where({ 'saved_trades.id': savedTradeId, 'portfolios.user_id': userId })
      .select('saved_trades.*', 'portfolios.competition_id')
      .first()

    if (!savedTrade) {
      throw new Error('Saved trade not found or unauthorized')
    }

    const result = await this.placeTrade(userId, savedTrade.competition_id, {
      symbol: savedTrade.symbol,
      optionSymbol: savedTrade.option_symbol,
      type: savedTrade.type,
      side: savedTrade.side,
      quantity: savedTrade.quantity,
    })

    await db('saved_trades').where({ id: savedTradeId }).delete()

    return result
  }

  async getPortfolioHistory(portfolioId: number) {
    const history = await db('portfolio_history')
      .where({ portfolio_id: portfolioId })
      .orderBy('timestamp', 'asc')
      .select('total_value', 'cash_balance', 'timestamp')

    return history.map((row: any) => ({
      totalValue: Number(row.total_value),
      cashBalance: Number(row.cash_balance),
      timestamp: row.timestamp,
    }))
  }
}

export default new TradingService()
