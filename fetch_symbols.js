const fs = require('fs')
const https = require('https')
const path = require('path')

const urls = [
  'https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/nasdaq/nasdaq_full_tickers.json',
  'https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/nyse/nyse_full_tickers.json',
  'https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/amex/amex_full_tickers.json',
]

const commonEtfs = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { symbol: 'IVV', name: 'iShares Core S&P 500 ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'EFA', name: 'iShares MSCI EAFE ETF' },
  { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF' },
  { symbol: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR Fund' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR Fund' },
  { symbol: 'XLI', name: 'Industrials Select Sector SPDR Fund' },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR Fund' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund' },
  { symbol: 'XLB', name: 'Materials Select Sector SPDR Fund' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR Fund' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
  { symbol: 'HYG', name: 'iShares iBoxx $ High Yield Corporate Bond ETF' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust' },
]

const fetchUrl = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', (err) => reject(err))
  })
}

async function updateSymbols() {
  try {
    console.log('Fetching stock data from exchanges...')
    const results = await Promise.all(urls.map((url) => fetchUrl(url)))
    const allStocks = results.flat()

    console.log(`Total raw symbols fetched: ${allStocks.length}`)

    // Process and sort by market cap
    const processedStocks = allStocks
      .map((stock) => {
        const marketCap = parseFloat(stock.marketCap)
        return {
          symbol: stock.symbol,
          name: stock.name,
          marketCap: isNaN(marketCap) ? 0 : marketCap,
        }
      })
      .sort((a, b) => b.marketCap - a.marketCap)

    // Take top 600
    const topStocks = processedStocks
      .slice(0, 600)
      .map((s) => ({ symbol: s.symbol, name: s.name }))

    // Merge with common ETFs (priority to ETFs so we ensure they are included)
    const combined = [...commonEtfs, ...topStocks]

    // Deduplicate
    const uniqueMap = new Map()
    combined.forEach((item) => {
      if (!uniqueMap.has(item.symbol)) {
        uniqueMap.set(item.symbol, item)
      }
    })

    const finalList = Array.from(uniqueMap.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    )

    const outputPath = path.join(__dirname, 'frontend/src/assets/data/symbols.json')
    const outputDir = path.dirname(outputPath)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(finalList, null, 2))

    console.log(`Successfully wrote ${finalList.length} symbols to ${outputPath}`)

    // Validation check for CVNA
    const cvna = finalList.find((s) => s.symbol === 'CVNA')
    if (cvna) {
      console.log('Validation SUCCESS: CVNA is present in the list.')
    } else {
      console.log('Validation WARNING: CVNA is NOT in the top list. Check market cap data.')
      // Fallback or debug info
      const cvnaRaw = processedStocks.find((s) => s.symbol === 'CVNA')
      if (cvnaRaw) {
        console.log(`CVNA Market Cap in data: ${cvnaRaw.marketCap}`)
      } else {
        console.log('CVNA not found in raw data.')
      }
    }
  } catch (error) {
    console.error('Error updating symbols:', error)
    process.exit(1)
  }
}

updateSymbols()
