import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
let authRoutes
let userRoutes
let hatimRoutes

dotenv.config()

const app = express()
const PORT =
    process.env.PORT ||
    process.env.PASSENGER_APP_PORT ||
    (process.env.NODE_ENV === 'production' ? undefined : (process.env.API_PORT || 3001))

const logDir = path.join(process.cwd(), 'tmp')
const logFile = path.join(logDir, 'startup.log')
const envFile = path.join(logDir, 'env.json')
const log = (message) => {
    try {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`)
    } catch (_) {
        // noop: logging should never crash app
    }
}

log(`boot: NODE_ENV=${process.env.NODE_ENV || ''} PORT=${process.env.PORT || ''} PASSENGER_APP_PORT=${process.env.PASSENGER_APP_PORT || ''} API_PORT=${process.env.API_PORT || ''}`)
try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    fs.writeFileSync(envFile, JSON.stringify({
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        PASSENGER_APP_PORT: process.env.PASSENGER_APP_PORT,
        PASSENGER_APP_ENV: process.env.PASSENGER_APP_ENV,
        PASSENGER_APP_ROOT: process.env.PASSENGER_APP_ROOT
    }, null, 2))
} catch (_) {
    // noop
}

process.on('uncaughtException', (err) => {
    log(`uncaughtException: ${err?.stack || err}`)
})
process.on('unhandledRejection', (err) => {
    log(`unhandledRejection: ${err?.stack || err}`)
})

try {
    const authMod = await import('./routes/auth.js')
    const userMod = await import('./routes/users.js')
    const hatimMod = await import('./routes/hatims.js')
    authRoutes = authMod.default
    userRoutes = userMod.default
    hatimRoutes = hatimMod.default
} catch (err) {
    log(`importError: ${err?.stack || err}`)
    throw err
}

// Middleware
const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://bezmidar.de',
    'https://www.bezmidar.de'
]
const envOrigins = (process.env.FRONTEND_ORIGINS || process.env.APP_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true)
        if (allowedOrigins.includes(origin)) return cb(null, true)
        return cb(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true
}))
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Root check (useful for hosting health probes)
app.get('/', (req, res) => {
    res.json({ status: 'ok' })
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

if (process.env.NODE_ENV !== 'production') {
    const devPort = PORT || 3001
    app.listen(devPort, '0.0.0.0', () => {
        log(`listening: dev port=${devPort}`)
        console.log(`🚀 Backend running on port ${devPort}`)
    })
} else {
    log('passenger: production mode, no manual listen')
}

export default app
