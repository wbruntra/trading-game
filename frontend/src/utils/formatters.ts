// Accepts string in 'YYYY-MM-DD' or 'YYMMDD' format
export const formatExpiration = (dateStr: string) => {
  if (!dateStr) return dateStr

  let date: Date

  // Handle YYYY-MM-DD
  if (dateStr.includes('-')) {
    // Parse as local date to avoid timezone shifts
    const [y, m, d] = dateStr.split('-').map(Number)
    date = new Date(y, m - 1, d)
  }
  // Handle YYMMDD
  else if (dateStr.length === 6) {
    const yy = dateStr.substring(0, 2)
    const mm = dateStr.substring(2, 4)
    const dd = dateStr.substring(4, 6)
    date = new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd))
  } else {
    return dateStr
  }

  const currentYear = new Date().getFullYear()
  const expirationYear = date.getFullYear()

  if (expirationYear === currentYear) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
}
