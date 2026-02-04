import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Users Table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary()
    table.string('username').notNullable().unique()
    table.string('password_hash').notNullable() // In real app, bcrypt/argon2
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })

  // Competitions Table
  await knex.schema.createTable('competitions', (table) => {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.timestamp('start_date').notNullable()
    table.timestamp('end_date').notNullable()
    table.decimal('initial_balance', 14, 2).notNullable()
    table.string('status').defaultTo('active') // active, completed
    table.integer('created_by').references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })

  // Portfolios Table (Link user to competition)
  await knex.schema.createTable('portfolios', (table) => {
    table.increments('id').primary()
    table.integer('user_id').references('id').inTable('users').onDelete('CASCADE')
    table.integer('competition_id').references('id').inTable('competitions').onDelete('CASCADE')
    table.decimal('cash_balance', 14, 2).notNullable()
    table.unique(['user_id', 'competition_id'])
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })

  // Trades Table
  await knex.schema.createTable('trades', (table) => {
    table.increments('id').primary()
    table.integer('portfolio_id').references('id').inTable('portfolios').onDelete('CASCADE')
    table.string('symbol').notNullable() // e.g., AAPL
    table.string('option_symbol').notNullable() // e.g., AAPL260204C00250000
    table.string('type').notNullable() // BUY or SELL
    table.string('side').notNullable() // CALL or PUT
    table.integer('quantity').notNullable()
    table.decimal('price', 14, 2).notNullable()
    table.timestamp('timestamp').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('trades')
  await knex.schema.dropTableIfExists('portfolios')
  await knex.schema.dropTableIfExists('competitions')
  await knex.schema.dropTableIfExists('users')
}
