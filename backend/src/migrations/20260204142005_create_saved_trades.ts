import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Saved Trades Table (Trade Queue)
  await knex.schema.createTable('saved_trades', (table) => {
    table.increments('id').primary()
    table.integer('portfolio_id').references('id').inTable('portfolios').onDelete('CASCADE')
    table.string('symbol').notNullable() // e.g., AAPL
    table.string('option_symbol').notNullable() // e.g., AAPL260204C00250000
    table.string('type').notNullable() // BUY or SELL
    table.string('side').notNullable() // CALL or PUT
    table.integer('quantity').notNullable()
    table.decimal('strike_price', 14, 2).notNullable()
    table.bigInteger('expiration_date').notNullable() // Unix timestamp
    table.string('note').nullable() // Optional user note
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('saved_trades')
}
