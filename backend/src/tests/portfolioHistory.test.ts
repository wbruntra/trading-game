import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app'
import db from '../config/db'
import authService from '../services/authService'
import competitionService from '../services/competitionService'
import tradingService from '../services/tradingService'

describe('Portfolio History Snapshot', () => {
  let token: string
  let userId: string
  let competitionId: string
  let portfolioId: string

  beforeAll(async () => {
    await db.migrate.latest()

    // Clean up
    await db('portfolio_history').del()
    await db('trades').del()
    await db('portfolios').del()
    await db('competitions').del()
    await db('users').del()

    // Register User
    await authService.register('history_user', 'password123')
    const { token: t, user } = await authService.login('history_user', 'password123')
    token = t
    userId = user.id

    // Create Competition
    const competition = await competitionService.createCompetition(userId, {
      name: 'History Comp',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      initialBalance: 100000,
    })
    competitionId = competition.id

    // Get Portfolio ID
    const portfolio = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()
    portfolioId = portfolio.id

    // Place a trade to have some value
    await tradingService.placeTrade(Number(userId), Number(competitionId), {
      symbol: 'SPY',
      optionSymbol: 'SPY240621C00500000',
      type: 'BUY',
      side: 'CALL',
      quantity: 1,
    })
  })

  afterAll(async () => {
    await db('portfolio_history').del()
    await db('trades').del()
    await db('portfolios').del()
    await db('competitions').del()
    await db('users').del()
    await db.destroy()
  })

  it('should create a snapshot entry', async () => {
    // Manually trigger snapshot
    const result = await tradingService.snapshotAllPortfolios()

    expect(result.success).toBe(true)
    expect(result.count).toBeGreaterThan(0)

    // Verify DB
    const history = await db('portfolio_history').where({ portfolio_id: portfolioId })
    expect(history.length).toBe(1)
    expect(Number(history[0].total_value)).not.toBeNaN()
    // Initial 100k - Cost + Current Value roughly equals 100k (maybe slightly different due to bid/ask/mock)
    // Just ensure it's not 0 or null
    expect(history[0].total_value).toBeGreaterThan(0)
  })

  it('should be accessible via admin endpoint', async () => {
    const res = await request(app)
      .post('/api/trading/admin/snapshot')
      .set('Authorization', `Bearer ${token}`) // Even if auth token provided, we check header?
    // Actually the route currently uses authenticateToken (router.use above) so we need token + header potentially?
    // Let's check tradingRoutes.ts structure.
    // Yes, router.use(authenticateToken) is at the top.
    // So we need a valid token AND the header if configured (but env is test so header check might skipped or simple)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const history = await db('portfolio_history').where({ portfolio_id: portfolioId })
    expect(history.length).toBeGreaterThanOrEqual(2) // One from previous test, one from this
  })
})
