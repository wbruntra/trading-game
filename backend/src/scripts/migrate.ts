import knex from 'knex'
import knexConfig from '../../knexfile'

const environment = process.env.NODE_ENV || 'development'
const config = knexConfig[environment as keyof typeof knexConfig]

const db = knex(config)

async function runMigrations() {
  try {
    console.log('Running migrations...')
    const [batchNo, migrations] = await db.migrate.latest()
    if (migrations.length === 0) {
      console.log('Already up to date')
    } else {
      console.log(`Batch ${batchNo} run: ${migrations.length} migrations`)
      migrations.forEach((m: string) => console.log(`  - ${m}`))
    }
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

runMigrations()
