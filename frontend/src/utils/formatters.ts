export const formatExpiration = (yyyymmdd: string) => {
  if (!yyyymmdd || yyyymmdd.length !== 6) return yyyymmdd
  const yy = yyyymmdd.substring(0, 2)
  const mm = yyyymmdd.substring(2, 4)
  const dd = yyyymmdd.substring(4, 6)
  const date = new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd))
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}
