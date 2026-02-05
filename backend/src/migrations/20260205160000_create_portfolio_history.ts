import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('portfolio_history', (table) => {
    table.increments('id').primary()
    table
      .integer('portfolio_id')
      .references('id')
      .inTable('portfolios')
      .onDelete('CASCADE')
      .notNullable()
    table.decimal('total_value', 14, 2).notNullable()
    table.decimal('cash_balance', 14, 2).notNullable()
    table.timestamp('timestamp').defaultTo(knex.fn.now())

    // Index for quick history lookups
    table.index(['portfolio_id', 'timestamp'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('portfolio_history')
}
