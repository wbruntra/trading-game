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

  async getQuote(symbol: string | string[]) {
    const isArrayInput = Array.isArray(symbol)
    const symbols = isArrayInput ? symbol : [symbol]
    const uniqueSymbols = Array.from(new Set(symbols))

    const cachedQuotes: any[] = []
    const missingSymbols: string[] = []

    // 1. Check Cache for each symbol
    for (const s of uniqueSymbols) {
      const cacheKey = `quote_${s}`
      const cached = cache.get(cacheKey)
      if (cached) {
        cachedQuotes.push(cached)
      } else {
        missingSymbols.push(s)
      }
    }

    let fetchedQuotes: any[] = []

    // 2. Fetch missing symbols
    if (missingSymbols.length > 0) {
      // console.log(`[MarketData] Fetching missing symbols: ${missingSymbols.join(', ')}`)
      try {
        const result = await yahooFinance.quote(missingSymbols)
        fetchedQuotes = Array.isArray(result) ? result : [result]

        // Cache new results
        for (const q of fetchedQuotes) {
          if (q && q.symbol) {
            cache.set(`quote_${q.symbol}`, q)
          }
        }
      } catch (error) {
        console.error(`Error in MarketDataService.getQuote for ${missingSymbols}:`, error)
        throw error
      }
    }

    // 3. Combine results
    const allQuotes = [...cachedQuotes, ...fetchedQuotes]

    if (isArrayInput) {
      return allQuotes
    } else {
      // If single string requested, return the single object (or first found)
      return allQuotes.find((q) => q.symbol === symbol) || allQuotes[0]
    }
  }
}

export default new MarketDataService()
