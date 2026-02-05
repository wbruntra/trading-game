import { Router, Response } from 'express'
import tradingService from '@/services/tradingService'
import { authenticateToken, AuthRequest } from '@/middleware/authMiddleware'

const router = Router()

// Admin/System Routes
router.post('/admin/snapshot', async (req: AuthRequest, res: Response) => {
  try {
    // Simple verification - in prod use a stronger secret check
    const secret = req.headers['x-admin-secret']
    if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const result = await tradingService.snapshotAllPortfolios()
    res.json(result)
  } catch (error: any) {
    console.error('Snapshot failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.use(authenticateToken)

router.post('/competitions/:competitionId/trade', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { competitionId } = req.params
    const { symbol, optionSymbol, type, side, quantity } = req.body

    if (!symbol || !optionSymbol || !type || !side || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate types
    if (type !== 'BUY' && type !== 'SELL') return res.status(400).json({ error: 'Invalid type' })
    if (side !== 'CALL' && side !== 'PUT') return res.status(400).json({ error: 'Invalid side' })

    // Handle TS potentially viewing params as array, though express usually string
    const compIdString = Array.isArray(competitionId) ? competitionId[0] : competitionId

    const result = await tradingService.placeTrade(userId, Number(compIdString), {
      symbol,
      optionSymbol,
      type,
      side,
      quantity: Number(quantity),
    })

    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/portfolios', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const portfolios = await tradingService.getPortfolios(userId)
    res.json(portfolios)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/portfolios/:portfolioId', async (req: AuthRequest, res: Response) => {
  try {
    const { portfolioId } = req.params
    const pIdString = Array.isArray(portfolioId) ? portfolioId[0] : portfolioId
    const portfolio = await tradingService.getPortfolio(Number(pIdString))

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' })
    }

    // Basic clean check: ensure user owns this portfolio or is viewing public data?
    // For now allow viewing if auth'd.

    res.json(portfolio)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/portfolios/competition/:competitionId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { competitionId } = req.params
    const compIdString = Array.isArray(competitionId) ? competitionId[0] : competitionId

    const portfolio = await tradingService.getPortfolioByCompetition(userId, Number(compIdString))

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found for this competition' })
    }

    res.json(portfolio)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/competitions/:competitionId/leaderboard', async (req: AuthRequest, res: Response) => {
  try {
    const { competitionId } = req.params
    const refresh = req.query.refresh === 'true'
    const compIdString = Array.isArray(competitionId) ? competitionId[0] : competitionId

    const leaderboard = await tradingService.getLeaderboard(Number(compIdString), refresh)
    res.json(leaderboard)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Saved Trades Routes
router.post(
  '/competitions/:competitionId/saved-trades',
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id
      const { competitionId } = req.params
      const { symbol, optionSymbol, type, side, quantity, strikePrice, expirationDate, note } =
        req.body

      if (
        !symbol ||
        !optionSymbol ||
        !type ||
        !side ||
        !quantity ||
        strikePrice === undefined ||
        !expirationDate
      ) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      if (type !== 'BUY' && type !== 'SELL') return res.status(400).json({ error: 'Invalid type' })
      if (side !== 'CALL' && side !== 'PUT') return res.status(400).json({ error: 'Invalid side' })

      const compIdString = Array.isArray(competitionId) ? competitionId[0] : competitionId

      const savedTrade = await tradingService.saveTrade(userId, Number(compIdString), {
        symbol,
        optionSymbol,
        type,
        side,
        quantity: Number(quantity),
        strikePrice: Number(strikePrice),
        expirationDate: Number(expirationDate),
        note: note || null,
      })

      res.status(201).json(savedTrade)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  },
)

router.get(
  '/competitions/:competitionId/saved-trades',
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id
      const { competitionId } = req.params
      const compIdString = Array.isArray(competitionId) ? competitionId[0] : competitionId

      const savedTrades = await tradingService.getSavedTrades(userId, Number(compIdString))
      res.json(savedTrades)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

router.delete('/saved-trades/:savedTradeId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { savedTradeId } = req.params
    const savedTradeIdString = Array.isArray(savedTradeId) ? savedTradeId[0] : savedTradeId

    await tradingService.deleteSavedTrade(userId, Number(savedTradeIdString))
    res.status(204).send()
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/saved-trades/:savedTradeId/execute', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { savedTradeId } = req.params
    const savedTradeIdString = Array.isArray(savedTradeId) ? savedTradeId[0] : savedTradeId

    const result = await tradingService.executeSavedTrade(userId, Number(savedTradeIdString))
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.post(
  '/competitions/:competitionId/spread-trade',
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id
      const { competitionId } = req.params
      const { symbol, spreadType, longLeg, shortLeg, quantity } = req.body

      if (
        !symbol ||
        !spreadType ||
        !longLeg ||
        !shortLeg ||
        !quantity ||
        !longLeg.optionSymbol ||
        !shortLeg.optionSymbol
      ) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      if (spreadType !== 'CALL_DEBIT' && spreadType !== 'PUT_DEBIT') {
        return res.status(400).json({ error: 'Invalid spread type' })
      }

      const compIdString = Array.isArray(competitionId) ? competitionId[0] : competitionId

      const result = await tradingService.placeSpreadTrade(userId, Number(compIdString), {
        symbol,
        spreadType,
        longLeg: {
          optionSymbol: longLeg.optionSymbol,
          strike: Number(longLeg.strike),
        },
        shortLeg: {
          optionSymbol: shortLeg.optionSymbol,
          strike: Number(shortLeg.strike),
        },
        quantity: Number(quantity),
      })

      res.status(200).json(result)
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  },
)

router.post('/spread/:spreadId/close', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id
    const { spreadId } = req.params
    const spreadIdString = Array.isArray(spreadId) ? spreadId[0] : spreadId

    const result = await tradingService.closeSpreadTrade(userId, spreadIdString)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

export default router
