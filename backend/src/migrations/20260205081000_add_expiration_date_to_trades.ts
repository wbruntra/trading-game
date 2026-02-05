import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. Add column
  await knex.schema.alterTable('trades', (table) => {
    table.date('expiration_date').nullable()
  })

  // 2. Backfill existing trades
  const trades = await knex('trades').select('id', 'option_symbol')

  for (const trade of trades) {
    if (!trade.option_symbol) continue

    // Regex to parse option symbol: Symbol + YYMMDD + C/P + Strike
    // e.g. AAPL260204C00250000
    const match = trade.option_symbol.match(/[A-Z]+(\d{6})[CP]\d{8}/)
    if (match) {
      const dateStr = match[1] // YYMMDD
      // Convert to YYYY-MM-DD
      const year = '20' + dateStr.substring(0, 2)
      const month = dateStr.substring(2, 4)
      const day = dateStr.substring(4, 6)
      const formattedDate = `${year}-${month}-${day}`

      await knex('trades').where({ id: trade.id }).update({ expiration_date: formattedDate })
    }
  }

  // 3. Make non-nullable after backfill (optional, but good practice if we want to enforce it moving forward)
  // SQLite doesn't support altering column to not null easily with data, so we might skip this constraint for now
  // or recreate table. For simplicity in this script, we'll leave it nullable but enforce it in code.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('trades', (table) => {
    table.dropColumn('expiration_date')
  })
}
