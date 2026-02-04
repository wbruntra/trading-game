import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('portfolios', (table) => {
    table.decimal('total_value', 14, 2).defaultTo(0)
    table.timestamp('last_updated_at').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('portfolios', (table) => {
    table.dropColumn('total_value')
    table.dropColumn('last_updated_at')
  })
}
