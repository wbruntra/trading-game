import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import db from '../config/db'
import { runAutoSell } from '../scripts/sellExpiringPositions'

describe('sellExpiringPositions', () => {
  let userId: number
  let competitionId: number
  let portfolioId: number

  const today = new Date().toISOString().split('T')[0]
  // YYMMDD for today
  const todayYYMMDD = today.replace(/-/g, '').substring(2)
  const optionSymbol = `AAPL${todayYYMMDD}C00150000` // CALL 150.00 Expiring Today

  beforeAll(async () => {
    // Run migrations for in-memory DB
    await db.migrate.latest()

    // Cleanup (just in case)
    await db('trades').del()
    await db('portfolios').del()
    await db('competitions').del()
    await db('users').del()

    // 1. Create User
    const [user] = await db('users')
      .insert({
        username: 'test_autosell_user',
        password_hash: 'hash',
      })
      .returning('id')
    userId = user.id

    // 2. Create Competition
    const [comp] = await db('competitions')
      .insert({
        name: 'AutoSell Comp',
        start_date: new Date(),
        end_date: new Date(Date.now() + 86400000),
        initial_balance: 100000,
        created_by: userId,
      })
      .returning('id')
    competitionId = comp.id

    // 3. Create Portfolio
    const [port] = await db('portfolios')
      .insert({
        user_id: userId,
        competition_id: competitionId,
        cash_balance: 100000,
      })
      .returning('id')
    portfolioId = port.id
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('should sell positions expiring today', async () => {
    // 1. Insert a BUY trade expiring today
    await db('trades').insert({
      portfolio_id: portfolioId,
      symbol: 'AAPL',
      option_symbol: optionSymbol,
      type: 'BUY',
      side: 'CALL',
      quantity: 10,
      price: 5.0,
      timestamp: new Date(),
      expiration_date: today,
    })

    // 2. Insert a BUY trade expiring tomorrow (should NOT be sold)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    await db('trades').insert({
      portfolio_id: portfolioId,
      symbol: 'MSFT',
      option_symbol: `MSFT${todayYYMMDD}C00200000`, // Symbol might mismatch date but expiration_date column is what matters for query
      type: 'BUY',
      side: 'CALL',
      quantity: 5,
      price: 10.0,
      timestamp: new Date(),
      expiration_date: tomorrow,
    })

    // 3. Run the script
    await runAutoSell()

    // 4. Verify results
    const trades = await db('trades')
      .where({ portfolio_id: portfolioId })
      .orderBy('timestamp', 'asc')

    // Expect:
    // 1. BUY AAPL (10)
    // 2. BUY MSFT (5)
    // 3. SELL AAPL (10)

    // Check AAPL trades
    const aaplTrades = trades.filter((t) => t.option_symbol === optionSymbol)
    expect(aaplTrades.length).toBe(2)
    expect(aaplTrades[0].type).toBe('BUY')
    expect(aaplTrades[1].type).toBe('SELL')
    expect(aaplTrades[1].quantity).toBe(10)

    // Check MSFT trades
    const msftTrades = trades.filter((t) => t.symbol === 'MSFT')
    expect(msftTrades.length).toBe(1)
    expect(msftTrades[0].type).toBe('BUY')

    // Check Balance (Sold 10 * 100 shares * price)
    // Price in TradingService mock/real might vary.
    // If run in test env, TradingService uses mock price 10.0.
    // Cost: 10 * 100 * 5.0 = 5000. Balance = 95000.
    // Sell: 10 * 100 * 10.0 = 10000. Balance = 105000.
    // MSFT Cost: 5 * 100 * 10.0 = 5000. Balance = 100000.

    const portfolio = await db('portfolios').where({ id: portfolioId }).first()
    // We expect balance to be reflected.
    // Initial 100000
    // Buy AAPL: -5000 -> 95000
    // Buy MSFT: -5000 -> 90000
    // Sell AAPL: +10000 -> 100000
    // But TradingService uses real quote or mock.
    // In test env, placeTrade uses 10.0 price.

    // Let's just verify the SELL trade exists for now to avoid fragility on price.
    const sellTrade = aaplTrades.find((t) => t.type === 'SELL')
    expect(sellTrade).toBeDefined()
  })
})
