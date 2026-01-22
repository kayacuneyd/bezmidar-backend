import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import db from '../config/db.js'
import { sendMagicLinkEmail } from '../services/emailService.js'

const router = express.Router()

// POST /api/auth/magic-link - Send magic link email
router.post('/magic-link', async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({ message: 'Email adresi gerekli' })
        }

        // Find or create user
        let [users] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        )

        let userId

        if (users.length === 0) {
            // Create new user
            const [result] = await db.execute(
                'INSERT INTO users (email) VALUES (?)',
                [email]
            )
            userId = result.insertId
        } else {
            userId = users[0].id
        }

        // Generate magic link token
        const token = uuidv4()
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

        // Invalidate old tokens
        await db.execute(
            'UPDATE magic_links SET used = TRUE WHERE user_id = ? AND used = FALSE',
            [userId]
        )

        // Save new token
        await db.execute(
            'INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        )

        // Send email
        const result = await sendMagicLinkEmail(email, token)

        res.json({
            message: 'Giriş linki gönderildi',
            // In development, return the link directly
            ...(process.env.NODE_ENV === 'development' && { devLink: result.devLink })
        })
    } catch (error) {
        console.error('Magic link error:', error)
        res.status(500).json({ message: 'Email gönderilemedi' })
    }
})

// POST /api/auth/verify - Verify magic link token
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body

        if (!token) {
            return res.status(400).json({ message: 'Token gerekli' })
        }

        // Find valid token
        const [links] = await db.execute(
            `SELECT ml.*, u.email, u.first_name, u.last_name, u.is_profile_complete
       FROM magic_links ml
       JOIN users u ON ml.user_id = u.id
       WHERE ml.token = ? AND ml.used = FALSE AND ml.expires_at > NOW()`,
            [token]
        )

        if (links.length === 0) {
            return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş link' })
        }

        const link = links[0]

        // Mark token as used
        await db.execute(
            'UPDATE magic_links SET used = TRUE WHERE id = ?',
            [link.id]
        )

        // Generate JWT
        const jwtToken = jwt.sign(
            { userId: link.user_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        )

        res.json({
            token: jwtToken,
            user: {
                id: link.user_id,
                email: link.email,
                first_name: link.first_name,
                last_name: link.last_name,
                is_profile_complete: !!link.is_profile_complete
            }
        })
    } catch (error) {
        console.error('Verify error:', error)
        res.status(500).json({ message: 'Doğrulama başarısız' })
    }
})

export default router
