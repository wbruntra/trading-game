/**
 * Checks if the US Market (NYSE/NASDAQ) is currently open.
 * Standard hours: 9:30 AM - 4:00 PM ET, Monday - Friday.
 * Note: This does not account for exchange holidays.
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  // Convert current time to New York time
  const nyTimeStr = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Format can be "Wed 09:30" or "Wed, 09:30" depending on environment
  const match = nyTimeStr.match(/(\w+)[, ]+(\d{2}):(\d{2})/)
  if (!match) return false

  const [, day, hour, minute] = match
  const hourNum = parseInt(hour, 10)
  const minNum = parseInt(minute, 10)

  // Check weekend
  if (['Sat', 'Sun'].includes(day)) return false

  // Check hours (9:30 - 16:00)
  const timeInMinutes = hourNum * 60 + minNum
  const openTime = 9 * 60 + 30
  const closeTime = 16 * 60

  return timeInMinutes >= openTime && timeInMinutes < closeTime
}
