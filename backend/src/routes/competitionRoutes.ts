import { Router, Response } from 'express'
import competitionService from '../services/competitionService'
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware'

const router = Router()

// Protect all routes
router.use(authenticateToken)

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { name, startDate, endDate, initialBalance } = req.body

    if (!name || !startDate || !endDate || !initialBalance) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const competition = await competitionService.createCompetition(userId, {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      initialBalance,
    })
    res.status(201).json(competition)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/:id/join', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    const idString = Array.isArray(id) ? id[0] : id
    const portfolio = await competitionService.joinCompetition(userId, idString)
    res.status(200).json(portfolio)
  } catch (error: any) {
    if (error.message === 'Competition not found') {
      return res.status(404).json({ error: error.message })
    }
    res.status(400).json({ error: error.message })
  }
})

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const competitions = await competitionService.getCompetitions()
    res.json(competitions)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const idString = Array.isArray(id) ? id[0] : id
    const competition = await competitionService.getCompetition(idString)
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' })
    }
    res.json(competition)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
