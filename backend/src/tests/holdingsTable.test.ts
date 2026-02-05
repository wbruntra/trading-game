import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import db from '../config/db'
import authService from '../services/authService'
import competitionService from '../services/competitionService'
import tradingService from '../services/tradingService'

describe('Holdings Table Verification', () => {
  let userId: string
  let competitionId: string
  let portfolioId: number

  beforeAll(async () => {
    // Reset DB
    await db.migrate.latest()
    await db('holdings').del()
    await db('trades').del()
    await db('portfolios').del()
    await db('competitions').del()
    await db('users').del()

    // Setup
    await authService.register('holdings_user', 'password123')
    const { user } = await authService.login('holdings_user', 'password123')
    userId = user.id

    const competition = await competitionService.createCompetition(userId, {
      name: 'Holdings Comp',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      initialBalance: 100000,
    })
    competitionId = competition.id

    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()
    portfolioId = portfolio.id
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('should insert into holdings on BUY', async () => {
    // Buy 1 CALL
    const symbol = 'AAPL'
    const optionSymbol = 'AAPL240621C00200000'
    const quantity = 1

    await tradingService.placeTrade(Number(userId), Number(competitionId), {
      symbol,
      optionSymbol,
      type: 'BUY',
      side: 'CALL',
      quantity,
    })

    const holdings = await db('holdings').where({
      portfolio_id: portfolioId,
      option_symbol: optionSymbol,
    })
    expect(holdings.length).toBe(1)
    expect(holdings[0].quantity).toBe(1)
    expect(Number(holdings[0].cost_basis)).toBeGreaterThan(0)
    expect(holdings[0].spread_id).toBeNull()
  })

  it('should update holdings on second BUY', async () => {
    const symbol = 'AAPL'
    const optionSymbol = 'AAPL240621C00200000'
    const quantity = 2

    await tradingService.placeTrade(Number(userId), Number(competitionId), {
      symbol,
      optionSymbol,
      type: 'BUY',
      side: 'CALL',
      quantity,
    })

    const holdings = await db('holdings')
      .where({ portfolio_id: portfolioId, option_symbol: optionSymbol })
      .first()
    expect(holdings.quantity).toBe(1 + 2) // 3
    // Cost basis should increase
  })

  it('should update/delete holdings on SELL', async () => {
    const symbol = 'AAPL'
    const optionSymbol = 'AAPL240621C00200000'
    // Determine current held qty = 3

    // Sell 1
    await tradingService.placeTrade(Number(userId), Number(competitionId), {
      symbol,
      optionSymbol,
      type: 'SELL', // Wait, placeTrade handles logic or placeTradeInternal?
      // placeTradeInternal handles type 'SELL' in updated tradingService.
      side: 'CALL',
      quantity: 1,
    })

    let holdings = await db('holdings')
      .where({ portfolio_id: portfolioId, option_symbol: optionSymbol })
      .first()
    expect(holdings.quantity).toBe(2)

    // Sell remaining 2
    await tradingService.placeTrade(Number(userId), Number(competitionId), {
      symbol,
      optionSymbol,
      type: 'SELL',
      side: 'CALL',
      quantity: 2,
    })

    holdings = await db('holdings')
      .where({ portfolio_id: portfolioId, option_symbol: optionSymbol })
      .first()
    expect(holdings).toBeUndefined() // Should be deleted
  })

  it('should create 2 holdings rows for SPREAD', async () => {
    const longLeg = { optionSymbol: 'SPY240621C00500000', strike: 500 }
    const shortLeg = { optionSymbol: 'SPY240621C00505000', strike: 505 } // Short higher strike for Call Debit
    const quantity = 5

    const result = await tradingService.placeSpreadTrade(Number(userId), Number(competitionId), {
      symbol: 'SPY',
      spreadType: 'CALL_DEBIT',
      longLeg,
      shortLeg,
      quantity,
    })

    const spreadId = result.spreadId
    expect(spreadId).toBeDefined()

    const holdings = await db('holdings').where({ portfolio_id: portfolioId, spread_id: spreadId })
    expect(holdings.length).toBe(2)

    const longH = holdings.find((h) => h.option_symbol === longLeg.optionSymbol)
    const shortH = holdings.find((h) => h.option_symbol === shortLeg.optionSymbol)

    expect(longH.quantity).toBe(5)
    expect(shortH.quantity).toBe(-5)
    expect(Number(longH.cost_basis)).toBeGreaterThan(0)
    expect(Number(shortH.cost_basis)).toBeLessThan(0) // Credit (negative cost)
  })

  it('should delete both spread rows on CLOSE', async () => {
    // Find the spreadId from previous test? Hard without return capture being scoped out.
    // Fetch it.
    const holdings = await db('holdings')
      .where({ portfolio_id: portfolioId })
      .whereNotNull('spread_id')
    const spreadId = holdings[0].spread_id

    await tradingService.closeSpreadTrade(Number(userId), spreadId)

    const remaining = await db('holdings').where({ spread_id: spreadId })
    expect(remaining.length).toBe(0)
  })
})
