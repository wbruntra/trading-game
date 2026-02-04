import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function checkSingleOption() {
  const contractSymbol = 'CVNA270115P00420000'
  console.log(`🔍 Fetching real-time quote for: ${contractSymbol}...`)

  try {
    const quote = await yahooFinance.quote(contractSymbol)

    console.log('\n--- SUCCESS ---')
    console.log(`Symbol:          ${quote.symbol}`)
    console.log(`Price:           $${quote.regularMarketPrice}`)
    console.log(`Bid:             $${quote.bid}`)
    console.log(`Ask:             $${quote.ask}`)
    console.log(`Strike:          $${quote.strike}`)
    console.log(`Expiration:      ${new Date(quote.expirationDate * 1000).toLocaleDateString()}`)
    console.log(`Quote Source:    ${quote.quoteSourceName}`)
    console.log('----------------\n')

    // Log more raw data if needed for debugging the structure
    // console.log('Raw Data:', JSON.stringify(quote, null, 2));
  } catch (error) {
    console.error('❌ Error fetching the specific option quote:', error)
  }
}

checkSingleOption()
