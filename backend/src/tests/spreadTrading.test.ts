import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app'
import db from '../config/db'
import authService from '../services/authService'
import competitionService from '../services/competitionService'
import tradingService from '../services/tradingService'

describe('Spread Trading', () => {
  let token: string
  let userId: number
  let competitionId: number
  let portfolioId: number

  beforeAll(async () => {
    await db.migrate.latest()

    // Register User
    const randomSuffix = Math.floor(Math.random() * 10000)
    const username = `spread_trader_${randomSuffix}`
    await authService.register(username, 'password123')
    const { token: t, user } = await authService.login(username, 'password123')
    token = t
    userId = user.id

    // Create Competition
    const competition = await competitionService.createCompetition(userId, {
      name: `Spread Trading Comp ${randomSuffix}`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      initialBalance: 100000,
    })
    competitionId = competition.id

    // Get Portfolio ID
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()
      .returning('*')
    portfolioId = portfolio.id
  })

  afterAll(async () => {
    // Cleanup if needed, but db.destroy usually handles connection closing
  })

  it('should place a CALL DEBIT SPREAD', async () => {
    const res = await request(app)
      .post(`/api/trading/competitions/${competitionId}/spread-trade`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'SPY',
        spreadType: 'CALL_DEBIT',
        longLeg: {
          optionSymbol: 'SPY260206C00590000', // Buy 590 Call
          strike: 590,
        },
        shortLeg: {
          optionSymbol: 'SPY260206C00595000', // Sell 595 Call
          strike: 595,
        },
        quantity: 1,
      })

    expect(res.status).toBe(200)
    expect(res.body.spreadId).toBeDefined()
    expect(res.body.netDebit).toBeGreaterThan(0)

    // Verify trades in DB
    const trades = await db('trades').where({ spread_id: res.body.spreadId })
    expect(trades.length).toBe(2)
    const buyLeg = trades.find((t) => t.type === 'BUY')
    const sellLeg = trades.find((t) => t.type === 'SELL')

    expect(buyLeg).toBeDefined()
    expect(sellLeg).toBeDefined()
    expect(buyLeg.side).toBe('CALL')
    expect(sellLeg.side).toBe('CALL')
  })

  it('should reject CALL DEBIT SPREAD with invalid strikes', async () => {
    const res = await request(app)
      .post(`/api/trading/competitions/${competitionId}/spread-trade`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'SPY',
        spreadType: 'CALL_DEBIT',
        longLeg: {
          optionSymbol: 'SPY260206C00600000', // Buy 600 Call (Higher)
          strike: 600,
        },
        shortLeg: {
          optionSymbol: 'SPY260206C00590000', // Sell 590 Call (Lower)
          strike: 590,
        },
        quantity: 1,
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Buying strike must be lower')
  })

  it('should show spread as a single holding in portfolio', async () => {
    const portfolio = await tradingService.getPortfolio(portfolioId)
    const holdings = portfolio.holdings

    const spreadHolding = holdings.find((h: any) => h.spreadType === 'CALL_DEBIT')
    expect(spreadHolding).toBeDefined()
    expect(spreadHolding.quantity).toBe(1)
    expect(spreadHolding.longLeg).toBeDefined()
    expect(spreadHolding.shortLeg).toBeDefined()
  })

  it('should close a spread trade', async () => {
    // get spread id from existing holding
    const portfolio = await tradingService.getPortfolio(portfolioId)
    const spreadHolding: any = portfolio.holdings.find((h: any) => h.spreadType === 'CALL_DEBIT')
    const spreadId = spreadHolding.spreadId

    const res = await request(app)
      .post(`/api/trading/spread/${spreadId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.netCredit).toBeDefined()

    // Verify holdings are gone
    const updatedPortfolio = await tradingService.getPortfolio(portfolioId)
    const updatedHoldings = updatedPortfolio.holdings
    const oldSpread = updatedHoldings.find((h: any) => h.spreadId === spreadId)
    expect(oldSpread).toBeUndefined()
  })
})
