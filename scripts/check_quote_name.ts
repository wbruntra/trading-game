import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function checkOptionsQuote() {
  const symbol = 'AAPL'
  console.log(`🔍 Fetching options for: ${symbol}...`)

  try {
    const result = await yahooFinance.options(symbol)
    if (result.quote) {
      console.log('✅ Found Quote Object:')
      console.log(`  Symbol:     ${result.quote.symbol}`)
      console.log(`  Long Name:  ${result.quote.longName}`)
      console.log(`  Short Name: ${result.quote.shortName}`)
    } else {
      console.log('❌ No Quote Object found in options result.')
    }
  } catch (error) {
    console.error('❌ Error fetching options:', error)
  }
}

checkOptionsQuote()
