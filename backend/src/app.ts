import express from 'express'
import morgan from 'morgan'
import marketDataRoutes from './routes/marketDataRoutes'
import authRoutes from './routes/authRoutes'
import competitionRoutes from './routes/competitionRoutes'
import tradingRoutes from './routes/tradingRoutes'

const app = express()

app.use(morgan('dev'))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/market', marketDataRoutes)
app.use('/api/competitions', competitionRoutes)
app.use('/api/trading', tradingRoutes)

app.get('/health', (req, res) => {
  res.send('OK')
})

export default app
