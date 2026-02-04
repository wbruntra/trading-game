import jwt from 'jsonwebtoken'

const token = jwt.sign(
  { id: 'user_123', email: 'test@example.com' },
  process.env.JWT_SECRET || 'supersecret',
  { expiresIn: '1h' },
)
console.log(token)
