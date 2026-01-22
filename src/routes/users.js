import express from 'express'
import bcrypt from 'bcryptjs'
import db from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// GET /api/users/me - Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, email, first_name, last_name, is_profile_complete, created_at FROM users WHERE id = ?',
            [req.userId]
        )

        if (users.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı' })
        }

        res.json(users[0])
    } catch (error) {
        console.error('Get user error:', error)
        res.status(500).json({ message: 'Kullanıcı bilgisi alınamadı' })
    }
})

// PUT /api/users/profile - Update profile (password required for first time)
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { password, first_name, last_name } = req.body

        // Get current user
        const [users] = await db.execute(
            'SELECT password_hash, is_profile_complete FROM users WHERE id = ?',
            [req.userId]
        )

        if (users.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı' })
        }

        const user = users[0]

        // If profile not complete, password is required
        if (!user.is_profile_complete && !password) {
            return res.status(400).json({ message: 'Şifre belirlemeniz gerekiyor' })
        }

        // Validate password if provided
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' })
            }
        }

        // Build update query
        const updates = []
        const values = []

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10)
            updates.push('password_hash = ?')
            values.push(passwordHash)
        }

        if (first_name !== undefined) {
            updates.push('first_name = ?')
            values.push(first_name)
        }

        if (last_name !== undefined) {
            updates.push('last_name = ?')
            values.push(last_name)
        }

        // Mark profile as complete
        updates.push('is_profile_complete = TRUE')

        values.push(req.userId)

        await db.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        )

        // Get updated user
        const [updatedUsers] = await db.execute(
            'SELECT id, email, first_name, last_name, is_profile_complete FROM users WHERE id = ?',
            [req.userId]
        )

        res.json({
            message: 'Profil güncellendi',
            user: updatedUsers[0]
        })
    } catch (error) {
        console.error('Update profile error:', error)
        res.status(500).json({ message: 'Profil güncellenemedi' })
    }
})

export default router
