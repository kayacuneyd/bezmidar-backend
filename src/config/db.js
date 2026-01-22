import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hatimconnect',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

// Test connection
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL connected')
        conn.release()
    })
    .catch(err => {
        console.error('❌ MySQL connection error:', err.message)
    })

export default pool
