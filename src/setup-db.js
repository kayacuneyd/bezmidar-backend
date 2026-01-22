import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

async function setupDatabase() {
    console.log('🔄 Veritabanına bağlanılıyor...')
    console.log(`   Host: ${process.env.DB_HOST}`)
    console.log(`   Database: ${process.env.DB_NAME}`)

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    })

    console.log('✅ Veritabanına bağlandı!')

    // Create tables
    const queries = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NULL,
      first_name VARCHAR(100) NULL,
      last_name VARCHAR(100) NULL,
      is_profile_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    );

    -- Magic links for passwordless login
    CREATE TABLE IF NOT EXISTS magic_links (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_user_expires (user_id, expires_at)
    );

    -- Hatims table
    CREATE TABLE IF NOT EXISTS hatims (
      id INT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      creator_id INT NOT NULL,
      is_public BOOLEAN DEFAULT FALSE,
      target_date DATE NULL,
      status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
      invite_code VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id),
      INDEX idx_invite_code (invite_code),
      INDEX idx_status (status)
    );

    -- Hatim participants
    CREATE TABLE IF NOT EXISTS hatim_participants (
      id INT PRIMARY KEY AUTO_INCREMENT,
      hatim_id INT NOT NULL,
      user_id INT NOT NULL,
      role ENUM('creator', 'participant') DEFAULT 'participant',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hatim_id) REFERENCES hatims(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE KEY unique_participant (hatim_id, user_id)
    );

    -- Juz assignments within a hatim
    CREATE TABLE IF NOT EXISTS juz_assignments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      hatim_id INT NOT NULL,
      user_id INT NULL,
      juz_number TINYINT NOT NULL,
      status ENUM('available', 'assigned', 'in_progress', 'completed') DEFAULT 'available',
      assigned_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (hatim_id) REFERENCES hatims(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE KEY unique_juz (hatim_id, juz_number)
    );

    -- Reading progress
    CREATE TABLE IF NOT EXISTS reading_progress (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      juz_assignment_id INT NULL,
      surah_number TINYINT NOT NULL,
      verse_number SMALLINT NOT NULL,
      last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (juz_assignment_id) REFERENCES juz_assignments(id) ON DELETE SET NULL,
      INDEX idx_user_progress (user_id, last_read_at)
    );
  `

    console.log('🔄 Tablolar oluşturuluyor...')
    await connection.query(queries)
    console.log('✅ Tablolar oluşturuldu!')

    // Show created tables
    const [tables] = await connection.query('SHOW TABLES')
    console.log('\n📋 Veritabanındaki tablolar:')
    tables.forEach(t => {
        const tableName = Object.values(t)[0]
        console.log(`   - ${tableName}`)
    })

    await connection.end()
    console.log('\n✅ Veritabanı kurulumu tamamlandı!')
}

setupDatabase().catch(err => {
    console.error('❌ Hata:', err.message)
    process.exit(1)
})
