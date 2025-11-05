import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { SessionManager } from '../sessionManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const instancesRouter = express.Router()

const sessionsDir = path.join(__dirname, '..', '..', 'sessions')
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true })

const manager = new SessionManager(sessionsDir)

/**
 * Create a new instance (but do not start connection yet)
 */
instancesRouter.post('/', async (req, res) => {
  const { name } = req.body || {}
  const id = uuidv4()
  await manager.createInstance(id, { name: name || `Instance ${id.slice(0,6)}` })
  res.status(201).json({ id })
})

/**
 * Start connection (will emit QR if not authenticated)
 */
instancesRouter.post('/:id/start', async (req, res) => {
  const { id } = req.params
  const started = await manager.start(id, req.app)
  if (!started) return res.status(404).json({ error: 'Instance not found' })
  res.json({ ok: true })
})

/**
 * Get list of instances with status
 */
instancesRouter.get('/', (_req, res) => {
  const list = manager.list().map(i => ({
    id: i.id, name: i.meta.name, status: i.status, createdAt: i.createdAt, webhook: i.meta.webhook || null
  }))
  res.json(list)
})

/**
 * Get a single instance
 */
instancesRouter.get('/:id', (req, res) => {
  const { id } = req.params
  const inst = manager.get(id)
  if (!inst) return res.status(404).json({ error: 'Not found' })
  res.json({
    id: inst.id, name: inst.meta.name, status: inst.status, createdAt: inst.createdAt, webhook: inst.meta.webhook || null
  })
})

/**
 * Set/Update webhook URL to forward incoming messages
 */
instancesRouter.put('/:id/webhook', async (req, res) => {
  const { id } = req.params
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url is required' })
  const ok = await manager.updateMeta(id, { webhook: url })
  if (!ok) return res.status(404).json({ error: 'Instance not found' })
  res.json({ ok: true })
})

/**
 * Get current QR (as dataURL). Also broadcasted via WebSocket.
 */
instancesRouter.get('/:id/qr', async (req, res) => {
  const { id } = req.params
  const inst = manager.get(id)
  if (!inst) return res.status(404).json({ error: 'Not found' })
  if (!inst.qr) return res.status(204).send() // no content (already authenticated or not ready)
  const dataURL = await QRCode.toDataURL(inst.qr)
  res.json({ qr: dataURL, ts: Date.now() })
})

/**
 * Send a text message
 */
instancesRouter.post('/:id/sendMessage', async (req, res) => {
  const { id } = req.params
  const { to, text } = req.body || {}
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' })
  try {
    const result = await manager.sendText(id, to, text)
    res.json({ ok: true, result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/**
 * Delete an instance (and its auth files)
 */
instancesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params
  const ok = await manager.remove(id)
  if (!ok) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})
