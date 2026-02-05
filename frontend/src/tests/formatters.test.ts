import { describe, it, expect } from 'bun:test'
import { formatExpiration } from '../utils/formatters'

describe('formatExpiration', () => {
  const currentYear = new Date().getFullYear()

  it('should handle traditional YYMMDD format', () => {
    // Current year + 1 to ensure year is shown
    const futureYear = (currentYear + 1).toString().substring(2)
    const formatted = formatExpiration(`${futureYear}0204`)
    expect(formatted).toContain('Feb 4')
    expect(formatted).toContain(20 + futureYear)
  })

  it('should handle YYYY-MM-DD format (active position)', () => {
    // Current year - year should be hidden
    const formatted = formatExpiration(`${currentYear}-03-15`)
    expect(formatted).toBe('Mar 15')
    expect(formatted).not.toContain(currentYear.toString())
  })

  it('should handle YYYY-MM-DD format (future year)', () => {
    const futureYear = currentYear + 1
    const formatted = formatExpiration(`${futureYear}-12-25`)
    expect(formatted).toBe(`Dec 25, ${futureYear}`)
  })
})
