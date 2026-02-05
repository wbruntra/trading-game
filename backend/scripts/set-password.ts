import bcrypt from 'bcrypt'
import db from '../src/config/db'

const SALT_ROUNDS = 10

async function listUsers() {
  try {
    const users = await db('users').select('id', 'username', 'created_at').orderBy('id')
    if (users.length === 0) {
      console.log('No users found')
      return
    }
    console.log('\nUsers:')
    console.log('-'.repeat(50))
    for (const user of users) {
      console.log(`  ID: ${user.id}, Username: ${user.username}, Created: ${user.created_at}`)
    }
    console.log('-'.repeat(50))
    console.log(`Total: ${users.length} user(s)\n`)
  } catch (error) {
    console.error('Error listing users:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

async function setPassword(username: string, password: string) {
  try {
    const user = await db('users').where({ username }).first()
    if (!user) {
      console.error(`Error: User '${username}' not found`)
      process.exit(1)
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    await db('users')
      .where({ username })
      .update({ password_hash: passwordHash })

    console.log(`Password updated for user '${username}'`)
  } catch (error) {
    console.error('Error updating password:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

const args = process.argv.slice(2)

if (args.length === 1 && args[0] === 'list') {
  listUsers()
} else if (args.length === 2) {
  const [username, password] = args
  setPassword(username, password)
} else {
  console.error('Usage:')
  console.error('  bun run set-password list')
  console.error('  bun run set-password <username> <password>')
  process.exit(1)
}
