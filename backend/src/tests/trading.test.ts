import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app'
import db from '../config/db'
import authService from '../services/authService'
import competitionService from '../services/competitionService'

describe('Trading', () => {
  let token: string
  let userId: string
  let competitionId: string
  let portfolioId: string

  beforeAll(async () => {
    await db.migrate.latest()

    // Register User
    await authService.register('trader_user', 'password123')
    const { token: t, user } = await authService.login('trader_user', 'password123')
    token = t
    userId = user.id

    // Create Competition
    const competition = await competitionService.createCompetition(userId, {
      name: 'Trading Comp',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      initialBalance: 100000,
    })
    competitionId = competition.id

    // Get Portfolio ID (automatically created when creating competition)
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()
    portfolioId = portfolio.id
  })

  afterAll(async () => {
    await db('trades').del()
    await db('portfolios').del()
    await db('competitions').del()
    await db('users').del()
    await db.destroy()
  })

  // Mock AAPL Price ~ $170 (or whatever test_options returns, but logic uses fallback for test)

  it('should place a BUY trade', async () => {
    const res = await request(app)
      .post(`/api/trading/competitions/${competitionId}/trade`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'AAPL',
        optionSymbol: 'AAPL240204C00200000', // Example symbol
        type: 'BUY',
        side: 'CALL',
        quantity: 1,
      })

    expect(res.status).toBe(200)
    expect(res.body.trade).toHaveProperty('id')
    expect(res.body.trade.type).toBe('BUY')
    expect(res.body.trade.quantity).toBe(1)

    // Check balance update (Initial 100000 - Cost)
    // Cost = Price * 1 * 100
    // If trade succeeded, balance should be less than 100000
    expect(res.body.newBalance).toBeLessThan(100000)
  })

  it('should not allow selling more than owned', async () => {
    const res = await request(app)
      .post(`/api/trading/competitions/${competitionId}/trade`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'AAPL',
        optionSymbol: 'AAPL240204C00200000',
        type: 'SELL',
        side: 'CALL',
        quantity: 100, // More than we bought (1)
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Insufficient position to sell')
  })

  it('should place a SELL trade', async () => {
    // Sell the 1 contract we bought
    const res = await request(app)
      .post(`/api/trading/competitions/${competitionId}/trade`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'AAPL',
        optionSymbol: 'AAPL240204C00200000',
        type: 'SELL',
        side: 'CALL',
        quantity: 1,
      })

    expect(res.status).toBe(200)
    expect(res.body.trade.type).toBe('SELL')
    // Balance should increase back (approx same if price didn't change, but it's a test env)
  })

  it('should view portfolio', async () => {
    const res = await request(app)
      .get(`/api/trading/portfolios/${portfolioId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', portfolioId)
    expect(res.body).toHaveProperty('trades')
    expect(res.body.trades.length).toBeGreaterThanOrEqual(2) // Buy and Sell
  })
})
