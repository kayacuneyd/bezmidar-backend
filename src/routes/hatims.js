import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// GET /api/hatims - List all hatims (public + user's private)
router.get('/', async (req, res) => {
    try {
        const userId = req.headers.authorization ? null : null // Optional auth

        const [hatims] = await db.execute(`
      SELECT h.*, u.first_name as creator_name,
        (SELECT COUNT(*) FROM hatim_participants WHERE hatim_id = h.id) as participant_count,
        (SELECT COUNT(*) FROM juz_assignments WHERE hatim_id = h.id AND status = 'completed') as completed_juz
      FROM hatims h
      LEFT JOIN users u ON h.creator_id = u.id
      WHERE h.is_public = TRUE AND h.status = 'active'
      ORDER BY h.created_at DESC
      LIMIT 20
    `)

        res.json({ hatims })
    } catch (error) {
        console.error('List hatims error:', error)
        res.status(500).json({ message: 'Hatimler yüklenemedi' })
    }
})

// GET /api/hatims/my - List user's hatims
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const [hatims] = await db.execute(`
      SELECT h.*, 
        hp.role,
        (SELECT COUNT(*) FROM hatim_participants WHERE hatim_id = h.id) as participant_count,
        (SELECT COUNT(*) FROM juz_assignments WHERE hatim_id = h.id AND status = 'completed') as completed_juz,
        (SELECT juz_number FROM juz_assignments WHERE hatim_id = h.id AND user_id = ? LIMIT 1) as my_juz
      FROM hatims h
      JOIN hatim_participants hp ON h.id = hp.hatim_id
      WHERE hp.user_id = ?
      ORDER BY h.created_at DESC
    `, [req.userId, req.userId])

        res.json({ hatims })
    } catch (error) {
        console.error('My hatims error:', error)
        res.status(500).json({ message: 'Hatimler yüklenemedi' })
    }
})

// GET /api/hatims/:id - Get hatim details
router.get('/:id', async (req, res) => {
    try {
        const [hatims] = await db.execute(`
      SELECT h.*, u.first_name as creator_name, u.email as creator_email
      FROM hatims h
      LEFT JOIN users u ON h.creator_id = u.id
      WHERE h.id = ?
    `, [req.params.id])

        if (hatims.length === 0) {
            return res.status(404).json({ message: 'Hatim bulunamadı' })
        }

        const hatim = hatims[0]

        // Get participants
        const [participants] = await db.execute(`
      SELECT hp.*, u.first_name, u.last_name, u.email
      FROM hatim_participants hp
      JOIN users u ON hp.user_id = u.id
      WHERE hp.hatim_id = ?
    `, [req.params.id])

        // Get juz assignments
        const [juzAssignments] = await db.execute(`
      SELECT ja.*, u.first_name, u.last_name
      FROM juz_assignments ja
      LEFT JOIN users u ON ja.user_id = u.id
      WHERE ja.hatim_id = ?
      ORDER BY ja.juz_number
    `, [req.params.id])

        res.json({
            hatim,
            participants,
            juzAssignments
        })
    } catch (error) {
        console.error('Get hatim error:', error)
        res.status(500).json({ message: 'Hatim yüklenemedi' })
    }
})

// GET /api/hatims/invite/:code - Get hatim by invite code
router.get('/invite/:code', async (req, res) => {
    try {
        const [hatims] = await db.execute(`
      SELECT h.*, u.first_name as creator_name,
        (SELECT COUNT(*) FROM hatim_participants WHERE hatim_id = h.id) as participant_count
      FROM hatims h
      LEFT JOIN users u ON h.creator_id = u.id
      WHERE h.invite_code = ? AND h.status = 'active'
    `, [req.params.code])

        if (hatims.length === 0) {
            return res.status(404).json({ message: 'Davet linki geçersiz veya hatim sonlanmış' })
        }

        res.json({ hatim: hatims[0] })
    } catch (error) {
        console.error('Get invite error:', error)
        res.status(500).json({ message: 'Davet bilgisi alınamadı' })
    }
})

// POST /api/hatims - Create new hatim
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, description, is_public, target_date } = req.body

        if (!title) {
            return res.status(400).json({ message: 'Hatim başlığı gerekli' })
        }

        const inviteCode = uuidv4().substring(0, 8)

        // Create hatim
        const [result] = await db.execute(`
      INSERT INTO hatims (title, description, creator_id, is_public, target_date, invite_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, description || null, req.userId, is_public || false, target_date || null, inviteCode])

        const hatimId = result.insertId

        // Add creator as participant
        await db.execute(`
      INSERT INTO hatim_participants (hatim_id, user_id, role)
      VALUES (?, ?, 'creator')
    `, [hatimId, req.userId])

        // Create 30 juz assignments (all available initially)
        for (let juz = 1; juz <= 30; juz++) {
            await db.execute(`
        INSERT INTO juz_assignments (hatim_id, juz_number, status)
        VALUES (?, ?, 'available')
      `, [hatimId, juz])
        }

        res.status(201).json({
            message: 'Hatim oluşturuldu',
            hatim: {
                id: hatimId,
                title,
                invite_code: inviteCode,
                invite_link: `${process.env.APP_URL}/hatim/join/${inviteCode}`
            }
        })
    } catch (error) {
        console.error('Create hatim error:', error)
        res.status(500).json({ message: 'Hatim oluşturulamadı' })
    }
})

// POST /api/hatims/:id/join - Join a hatim
router.post('/:id/join', authMiddleware, async (req, res) => {
    try {
        const hatimId = req.params.id

        // Check if hatim exists and is active
        const [hatims] = await db.execute(
            'SELECT * FROM hatims WHERE id = ? AND status = ?',
            [hatimId, 'active']
        )

        if (hatims.length === 0) {
            return res.status(404).json({ message: 'Hatim bulunamadı veya aktif değil' })
        }

        // Check if already joined
        const [existing] = await db.execute(
            'SELECT * FROM hatim_participants WHERE hatim_id = ? AND user_id = ?',
            [hatimId, req.userId]
        )

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Zaten bu hatime katılmışsınız' })
        }

        // Join hatim
        await db.execute(`
      INSERT INTO hatim_participants (hatim_id, user_id, role)
      VALUES (?, ?, 'participant')
    `, [hatimId, req.userId])

        res.json({ message: 'Hatime katıldınız' })
    } catch (error) {
        console.error('Join hatim error:', error)
        res.status(500).json({ message: 'Hatime katılınamadı' })
    }
})

// POST /api/hatims/join/:code - Join hatim by invite code
router.post('/join/:code', authMiddleware, async (req, res) => {
    try {
        const [hatims] = await db.execute(
            'SELECT id FROM hatims WHERE invite_code = ? AND status = ?',
            [req.params.code, 'active']
        )

        if (hatims.length === 0) {
            return res.status(404).json({ message: 'Geçersiz davet kodu' })
        }

        // Redirect to join by ID
        req.params.id = hatims[0].id
        return router.handle(req, res)
    } catch (error) {
        console.error('Join by code error:', error)
        res.status(500).json({ message: 'Hatime katılınamadı' })
    }
})

// POST /api/hatims/:id/assign-juz - Assign a juz to user
router.post('/:id/assign-juz', authMiddleware, async (req, res) => {
    try {
        const { juz_number } = req.body
        const hatimId = req.params.id

        if (!juz_number || juz_number < 1 || juz_number > 30) {
            return res.status(400).json({ message: 'Geçersiz cüz numarası' })
        }

        // Check if user is participant
        const [participants] = await db.execute(
            'SELECT * FROM hatim_participants WHERE hatim_id = ? AND user_id = ?',
            [hatimId, req.userId]
        )

        if (participants.length === 0) {
            return res.status(403).json({ message: 'Bu hatime katılmamışsınız' })
        }

        // Check if juz is available
        const [juz] = await db.execute(
            'SELECT * FROM juz_assignments WHERE hatim_id = ? AND juz_number = ?',
            [hatimId, juz_number]
        )

        if (juz.length === 0) {
            return res.status(404).json({ message: 'Cüz bulunamadı' })
        }

        if (juz[0].status !== 'available') {
            return res.status(400).json({ message: 'Bu cüz zaten alınmış' })
        }

        // Assign juz
        await db.execute(`
      UPDATE juz_assignments 
      SET user_id = ?, status = 'assigned', assigned_at = NOW()
      WHERE hatim_id = ? AND juz_number = ?
    `, [req.userId, hatimId, juz_number])

        res.json({ message: `Cüz ${juz_number} size atandı` })
    } catch (error) {
        console.error('Assign juz error:', error)
        res.status(500).json({ message: 'Cüz atanamadı' })
    }
})

// POST /api/hatims/:id/complete-juz - Mark juz as completed
router.post('/:id/complete-juz', authMiddleware, async (req, res) => {
    try {
        const { juz_number } = req.body
        const hatimId = req.params.id

        // Update juz status
        const [result] = await db.execute(`
      UPDATE juz_assignments 
      SET status = 'completed', completed_at = NOW()
      WHERE hatim_id = ? AND juz_number = ? AND user_id = ?
    `, [hatimId, juz_number, req.userId])

        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'Bu cüz size atanmamış' })
        }

        // Check if hatim is complete
        const [incomplete] = await db.execute(`
      SELECT COUNT(*) as count FROM juz_assignments 
      WHERE hatim_id = ? AND status != 'completed'
    `, [hatimId])

        if (incomplete[0].count === 0) {
            // Mark hatim as completed
            await db.execute(
                'UPDATE hatims SET status = ? WHERE id = ?',
                ['completed', hatimId]
            )
        }

        res.json({
            message: `Cüz ${juz_number} tamamlandı`,
            hatimCompleted: incomplete[0].count === 0
        })
    } catch (error) {
        console.error('Complete juz error:', error)
        res.status(500).json({ message: 'Cüz tamamlanamadı' })
    }
})

export default router
