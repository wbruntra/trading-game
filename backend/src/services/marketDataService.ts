import YahooFinance from 'yahoo-finance2'
import NodeCache from 'node-cache'

const yahooFinance = new YahooFinance()
const cache = new NodeCache({ stdTTL: 600 }) // Cache for 10 minutes

export class MarketDataService {
  async getOptionsChain(symbol: string, date?: number) {
    const cacheKey = `options_${symbol}_${date || 'current'}`
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      return cachedData
    }

    try {
      const queryOptions: any = { lang: 'en-US', formatted: false, region: 'US' }
      if (date) {
        queryOptions.date = date
      }

      const result = await yahooFinance.options(symbol, queryOptions)
      cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error(`Error in MarketDataService.getOptionsChain for ${symbol}:`, error)
      throw error
    }
  }

  async getQuote(symbol: string) {
    const cacheKey = `quote_${symbol}`
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      return cachedData
    }

    try {
      const result = await yahooFinance.quote(symbol)
      cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error(`Error in MarketDataService.getQuote for ${symbol}:`, error)
      throw error
    }
  }
}

export default new MarketDataService()
