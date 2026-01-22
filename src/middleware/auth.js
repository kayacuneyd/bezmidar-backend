import jwt from 'jsonwebtoken'

export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Yetkilendirme gerekli' })
        }

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        req.userId = decoded.userId
        next()
    } catch (error) {
        return res.status(401).json({ message: 'Geçersiz token' })
    }
}
