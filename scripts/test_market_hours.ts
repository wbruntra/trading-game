import { isMarketOpen } from '../backend/src/utils/marketHours'

function test() {
  const scenarios = [
    {
      date: new Date('2026-02-04T13:00:00Z'),
      expected: false,
      label: 'Wed 8:00 AM ET (Pre-market)',
    },
    { date: new Date('2026-02-04T15:00:00Z'), expected: true, label: 'Wed 10:00 AM ET (Open)' },
    { date: new Date('2026-02-04T20:30:00Z'), expected: true, label: 'Wed 3:30 PM ET (Open)' },
    {
      date: new Date('2026-02-04T22:00:00Z'),
      expected: false,
      label: 'Wed 5:00 PM ET (Post-market)',
    },
    {
      date: new Date('2026-02-08T15:00:00Z'),
      expected: false,
      label: 'Sun 10:00 AM ET (Weekend)',
    },
  ]

  console.log('🧪 Testing Market Hours Utility...')
  scenarios.forEach(({ date, expected, label }) => {
    const result = isMarketOpen(date)
    const status = result === expected ? '✅' : '❌'
    console.log(`${status} ${label}: Expected ${expected}, Got ${result}`)
  })
}

test()
