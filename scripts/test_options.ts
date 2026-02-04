import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function testOptions() {
  try {
    const symbol = 'AAPL'
    console.log(`Fetching options for ${symbol}...`)

    // We can also try fetching without extra options initially
    const queryOptions = { lang: 'en-US', formatted: false, region: 'US' }
    const result = await yahooFinance.options(symbol, queryOptions)

    console.log('Successfully fetched options data!')
    console.log('Result keys:', Object.keys(result))

    // Inspect specific parts based on keys found
    if (result.optionChain) {
      console.log('Found optionChain object.')
      const chain = result.optionChain
      if (chain.result && chain.result.length > 0) {
        const data = chain.result[0]
        console.log('Underlying Symbol:', data.underlyingSymbol)
        console.log('Expiration Dates:', data.expirationDates)
        console.log('Strikes:', data.strikes ? data.strikes.length : 'N/A')
        console.log('Has Options:', data.options && data.options.length > 0)

        if (data.options && data.options.length > 0) {
          const firstOptionSet = data.options[0]
          console.log('Calls count:', firstOptionSet.calls ? firstOptionSet.calls.length : 0)
          console.log('Puts count:', firstOptionSet.puts ? firstOptionSet.puts.length : 0)

          if (firstOptionSet.calls && firstOptionSet.calls.length > 0) {
            console.log('Sample Call:', JSON.stringify(firstOptionSet.calls[0], null, 2))
          }
        }
      }
    } else {
      // Fallback if structure is flat or different
      console.log('Full Result:', JSON.stringify(result, null, 2))
    }
  } catch (error) {
    console.error('Error fetching options:', error)
  }
}

testOptions()
