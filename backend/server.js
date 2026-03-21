const express = require('express')
const cors = require('cors')
require('dotenv').config()

// 1. Import ALL your routes
const sensorsRouter = require('./routes/sensors')
const authRouter = require('./routes/auth')
const dashboardRouter = require('./routes/dashboard')
const logsRouter = require('./routes/logs')
const alertsRouter = require('./routes/alerts')
const pondsRouter = require('./routes/ponds')
const usersRouter = require('./routes/users')
const zonesRouter = require('./routes/zones')
// Add scheduleRouter or devicesRouter if you created them!

const app = express()
app.use(cors())
app.use(express.json())

// Health check
app.get('/', (req, res) => res.json({ message: 'API đang chạy' }))

// 2. Connect ALL your routes to specific URLs
app.use('/api/sensors', sensorsRouter)
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/logs', logsRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/ponds', pondsRouter) // Mapped to your old aonuoi.py logic
app.use('/api/users', usersRouter)
app.use('/api/zones', zonesRouter) // Mapped to your old khuvuc.py logic

// Export app for testing
module.exports = app

// Start server
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`Server chạy port ${PORT}`)
  })
}