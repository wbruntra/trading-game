import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('trades', (table) => {
    table.string('spread_id').nullable().index()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('trades', (table) => {
    table.dropColumn('spread_id')
  })
}
