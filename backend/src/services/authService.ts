import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import db from '../config/db'

const SALT_ROUNDS = 10
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key' // In prod, use .env

export class AuthService {
  async register(username: string, password: string) {
    // Check if user exists
    const existingUser = await db('users').where({ username }).first()
    if (existingUser) {
      throw new Error('Username already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Insert user
    const [user] = await db('users')
      .insert({
        username,
        password_hash: passwordHash,
      })
      .returning(['id', 'username', 'created_at'])

    return user
  }

  async login(username: string, password: string) {
    const user = await db('users').where({ username }).first()
    if (!user) {
      throw new Error('Invalid credentials')
    }

    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      throw new Error('Invalid credentials')
    }

    // Generate user token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '30d',
    })

    return { token, user: { id: user.id, username: user.username } }
  }
}

export default new AuthService()
