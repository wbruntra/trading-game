import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app'
import db from '../config/db'

describe('Authentication', () => {
  beforeAll(async () => {
    // Run migrations before tests
    await db.migrate.latest()
  })

  afterAll(async () => {
    // Clean up
    await db('users').del()
    await db.destroy()
  })

  const testUser = {
    username: 'testuser_' + Date.now(),
    password: 'password123',
  }

  it('should register a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser)

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.username).toBe(testUser.username)
    expect(res.body).not.toHaveProperty('password_hash')
  })

  it('should not register user with existing username', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser)

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Username already exists')
  })

  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send(testUser)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.username).toBe(testUser.username)
  })

  it('should not login with invalid password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: testUser.username,
      password: 'wrongpassword',
    })

    expect(res.status).toBe(401)
  })
})
