import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function testBatchQuote() {
  const symbols = ['AAPL', 'MSFT', 'CVNA270115P00420000']
  console.log(`🔍 Attempting batch quote for: ${symbols.join(', ')}...`)

  try {
    const results = await yahooFinance.quote(symbols)

    console.log('\n--- SUCCESS ---')
    if (Array.isArray(results)) {
      results.forEach((quote) => {
        console.log(`${quote.symbol}: $${quote.regularMarketPrice}`)
      })
    } else {
      console.log('Result is not an array:', results)
    }
    console.log('----------------\n')
  } catch (error) {
    console.error('❌ Error during batch quote:', error)
  }
}

testBatchQuote()
