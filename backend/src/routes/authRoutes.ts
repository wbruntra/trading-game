import { Router, Request, Response } from 'express'
import authService from '../services/authService'
import { authenticateToken } from '../middleware/authMiddleware'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    const user = await authService.register(username, password)
    res.status(201).json(user)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body
    const result = await authService.login(username, password)
    res.json(result)
  } catch (error: any) {
    res.status(401).json({ error: error.message })
  }
})

router.get('/status', authenticateToken, (req: Request, res: Response) => {
  // If middleware passes, user is authenticated
  // req.user is populated by middleware
  res.json({ user: (req as any).user })
})

export default router
