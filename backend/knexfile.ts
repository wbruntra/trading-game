import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve(__dirname, 'dev.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/seeds'),
    },
  },
  test: {
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/seeds'),
    },
  },
}
