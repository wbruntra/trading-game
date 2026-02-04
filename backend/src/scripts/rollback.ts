import knex from 'knex'
import knexConfig from '../../knexfile'

const environment = process.env.NODE_ENV || 'development'
const config = knexConfig[environment as keyof typeof knexConfig]

const db = knex(config)

async function rollbackMigrations() {
  try {
    console.log('Rolling back migrations...')
    const [batchNo, migrations] = await db.migrate.rollback()
    if (migrations.length === 0) {
      console.log('Nothing to rollback')
    } else {
      console.log(`Batch ${batchNo} rolled back: ${migrations.length} migrations`)
      migrations.forEach((m: string) => console.log(`  - ${m}`))
    }
  } catch (error) {
    console.error('Rollback failed:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

rollbackMigrations()
