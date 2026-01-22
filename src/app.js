import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import hatimRoutes from './routes/hatims.js'

dotenv.config()

const app = express()
const PORT = process.env.API_PORT || 3001

// Middleware
app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true
}))
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/hatims', hatimRoutes)

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({
        message: 'Sunucu hatası',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint bulunamadı' })
})

app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`)
})

export default app
