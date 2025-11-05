import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pino from 'pino'
import { WebSocketServer } from 'ws'
import { instancesRouter } from './routes/instances.js'

const app = express()
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
app.set('logger', logger)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// health
app.get('/health', (_req,res)=> res.json({ ok: true }))

// routes
app.use('/api/instances', instancesRouter)

// Static serve QR snapshots if needed
app.use('/static', express.static('sessions'))

const port = process.env.PORT || 5173
const server = app.listen(port, ()=> logger.info(`HTTP listening on :${port}`))

// WebSocket for real-time QR & status push
const wss = new WebSocketServer({ server, path: '/ws' })
wss.on('connection', (socket, req) => {
  logger.info({ ip: req.socket.remoteAddress }, 'WebSocket connected')
  socket.on('close', ()=> logger.info('WebSocket disconnected'))
})

// Expose wss on app locals so routes can broadcast
app.set('wss', wss)
