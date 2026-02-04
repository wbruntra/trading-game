import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app'
import db from '../config/db'
import authService from '../services/authService'

describe('Competition', () => {
  let token: string
  let userId: string

  beforeAll(async () => {
    await db.migrate.latest()
    // Create user and get token
    await authService.register('comp_user', 'password123')
    const { token: t, user } = await authService.login('comp_user', 'password123')
    token = t
    userId = user.id
  })

  afterAll(async () => {
    await db('trades').del()
    await db('portfolios').del()
    await db('competitions').del()
    await db('users').del()
    await db.destroy()
  })

  let competitionId: string

  it('should create a competition', async () => {
    const res = await request(app)
      .post('/api/competitions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Competition',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        initialBalance: 10000,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.name).toBe('Test Competition')
    competitionId = res.body.id
  })

  it('should list competitions', async () => {
    const res = await request(app).get('/api/competitions').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('should join a competition (another user)', async () => {
    // Create specific user for joining
    await authService.register('joiner', 'password123')
    const { token: joinerToken } = await authService.login('joiner', 'password123')

    const res = await request(app)
      .post(`/api/competitions/${competitionId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id') // Portfolio ID
    expect(res.body.competition_id).toBe(competitionId)
    expect(parseFloat(res.body.cash_balance)).toBe(10000)
  })
})
