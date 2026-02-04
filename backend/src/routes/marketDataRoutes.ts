import { Router, Request, Response } from 'express'
import marketDataService from '../services/marketDataService'

const router = Router()

router.get('/options/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params
    const { date } = req.query
    const dateStr = Array.isArray(date) ? date[0] : (date as string)
    const dateNum = dateStr ? Number(dateStr) : undefined
    const data = await marketDataService.getOptionsChain(symbol, dateNum)
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch options data' })
  }
})

router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params
    const data = await marketDataService.getQuote(symbol)
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quote data' })
  }
})

export default router
