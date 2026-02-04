# Agentic Coding Guide

This document provides essential information for agentic coding agents operating in this trading game repository. It covers build commands, testing, and code style guidelines.

## Project Structure

- **Root**: Monorepo with shared dependencies; contains scripts and Bun configuration
- **`/backend`**: Express.js API server with SQLite database (Knex migrations)
- **`/frontend`**: React + Redux + TypeScript with Vite and Tailwind CSS

## Build & Development Commands

### Root Level
```bash
bun run dev       # Start both backend and frontend in watch mode
bun run start     # Start both in production mode
bun install       # Install all dependencies
```

### Backend
```bash
bun run dev       # Start Express server with watch mode (--watch)
bun run start     # Run production server
bun run migrate   # Run database migrations via Knex
bun run rollback  # Rollback database migrations
bun test          # Run test suite
```

**Running a Single Test:**
```bash
bun test backend/src/tests/auth.test.ts
```

### Frontend
```bash
bun run dev       # Start Vite dev server
bun run build     # Build for production (tsc + vite)
bun run lint      # Run ESLint checks
bun run preview   # Preview production build locally
```

## Testing

### Backend Tests
- **Framework**: Bun's built-in test runner (`bun:test`)
- **Location**: `/backend/src/tests/*.test.ts`
- **Test Database**: SQLite with automatic migrations in `beforeAll`
- **HTTP Testing**: Use `supertest` for API route testing
- **Pattern**: `describe`/`it` blocks with `expect` assertions

Example test structure (from `auth.test.ts`):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app'

describe('Feature', () => {
  beforeAll(async () => {
    // Setup: migrations, test data
  })
  afterAll(async () => {
    // Cleanup: database, connections
  })
  it('should do something', async () => {
    expect(value).toBe(expected)
  })
})
```

### Frontend Tests
- No test files currently; use ESLint for validation
- Add tests to `/frontend/src/**/*.test.tsx` if needed

## Code Style & Conventions

### Imports & Module Organization

**Order of Imports** (all three types are ES modules):
1. External packages (`express`, `react`, etc.)
2. Internal modules (from `@/` or relative imports)
3. Side effects (CSS imports last)

```typescript
import express from 'express'
import authRoutes from './routes/authRoutes'
import './styles.css'
```

**Use path aliases** (configured in `tsconfig.json`):
- Backend: `@/*` → `./src/*`
- Frontend: `@/*` → `./src/*`

**Dynamic imports** for lazy loading:
```typescript
const module = await import('./lazy-module')
```

### Formatting & Syntax

**TypeScript Compiler Options**:
- **Target**: ES2022 (backend), ES2023 (frontend node), ES2020 (browser)
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Enabled (`strict: true`)
- **No Emit**: Files are transpiled by Bun, not compiled

**Code Style**:
- Use ES2022+ features (async/await, optional chaining, nullish coalescing)
- No semicolons are not enforced; use them for clarity in complex cases
- Prefer const > let > var
- Use arrow functions for callbacks and single-expression functions

**Frontend (Vite + ESLint)**:
- ESLint enforces React hooks rules (`react-hooks/rules-of-hooks`)
- React refresh compatible (fast HMR)
- Use functional components with hooks (no class components)

**Backend (Express)**:
- Use middleware for cross-cutting concerns
- Keep route handlers thin; business logic in services
- Use async/await for async operations

### Type Safety

**TypeScript Configuration**:
- `strict: true` - all strict checks enabled
- `noUnusedLocals: true` - unused variables cause errors
- `noUnusedParameters: true` - unused parameters cause errors
- `noUncheckedIndexedAccess: true` - index access requires null checks
- `verbatimModuleSyntax: true` - type imports must use `type` keyword

**Type Annotations**:
```typescript
// Required: explicit types for function parameters and return values
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// Use type keyword for type-only imports
import type { User } from '@/types'

// For object types, prefer interfaces for public APIs
interface ApiResponse {
  status: 'success' | 'error'
  data?: unknown
}

// Use enums/unions for finite sets
type CompetitionStatus = 'active' | 'completed' | 'cancelled'
```

**Generic Types**:
```typescript
function getById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id)
}
```

### Naming Conventions

**PascalCase**: Types, interfaces, classes, React components
```typescript
type UserProfile = { name: string }
interface APIResponse { }
class DatabaseConnection { }
function UserCard() { /* component */ }
```

**camelCase**: Variables, functions, object properties, route parameters
```typescript
const maxRetries = 3
function fetchUserData(userId: string) { }
const { userName, userEmail } = user
```

**UPPER_SNAKE_CASE**: Constants and environment variables
```typescript
const MAX_REQUEST_TIMEOUT = 5000
const DATABASE_URL = process.env.DATABASE_URL
```

**Private/underscore**: Optional convention for internal functions
```typescript
function _parseDate(str: string): Date { }  // internal helper
const _cache = new Map()
```

### Error Handling

**Express Routes** - Return appropriate HTTP status codes:
```typescript
app.post('/api/users', async (req, res) => {
  if (!req.body.email) {
    return res.status(400).json({ error: 'Email required' })
  }
  try {
    const user = await db('users').insert(req.body)
    res.status(201).json(user)
  } catch (error) {
    console.error('User creation failed:', error)
    res.status(500).json({ error: 'Failed to create user' })
  }
})
```

**Async/Await** - Use try/catch blocks:
```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  // Log and handle appropriately
  console.error('Operation failed:', error)
  throw new Error(`Operation failed: ${message}`)
}
```

**React Components** - Handle errors in useEffect:
```typescript
useEffect(() => {
  const load = async () => {
    try {
      const data = await fetchData()
      setData(data)
    } catch (error) {
      console.error('Failed to load data:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    }
  }
  load()
}, [])
```

**Custom Error Classes** (optional but recommended):
```typescript
class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

### Database & Migrations

**Knex Migrations** (Backend):
- Stored in `/backend/src/migrations/`
- Format: `YYYYMMDDHHMMSS_description.ts`
- Use query builder for schema changes
- Always include both `up` and `down` methods

**Query Style**:
```typescript
// Backend Knex usage
const users = await db('users').where('active', true)
const user = await db('users').insert({ name: 'John' }).returning('*')
```

**Environment Variables**:
- Bun auto-loads `.env` files
- Use `process.env.VARIABLE_NAME` (no dotenv import needed)
- Backend expects: `DATABASE_URL`, `JWT_SECRET`, etc.

## Linting & Type Checking

**Frontend ESLint**:
```bash
cd frontend && bun run lint
```
- Enforces React hooks rules
- TypeScript strict mode checks
- No unused variables

**Backend**:
- Run `tsc` via Bun to check types: `bun --compile backend/src/server.ts`
- No separate linter configured; follow conventions above

## Important Notes for Agents

1. **Always use Bun** - Never use `node`, `npm`, or `yarn` commands
2. **Test after changes** - Run `bun test` in backend for API changes
3. **Check types** - TypeScript strict mode catches many errors early
4. **Path aliases** - Always use `@/` for imports within the project
5. **Watch mode** - Use `bun --watch` during development for faster feedback
6. **Migrations** - Create new migrations for schema changes; never modify existing ones
7. **No dotenv** - Environment variables are auto-loaded by Bun from `.env`
8. **React hooks** - Follow ESLint plugin rules; avoid stale closures
9. **API consistency** - Return error responses with appropriate HTTP status codes
10. **Git commits** - Make atomic, well-described commits for easier review

## Key Dependencies

**Backend**: Express.js, Knex, SQLite3, JWT, bcrypt, morgan
**Frontend**: React 19, Redux Toolkit, React Router, date-fns, react-hot-toast, Tailwind CSS
**Build**: TypeScript 5.9+, Vite, Bun
