import fs from 'fs'
import path from 'path'
import axios from 'axios'
import pino from 'pino'
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class SessionManager {
  constructor(baseDir) {
    this.baseDir = baseDir
    this.instances = new Map()
    this.logger = pino({ level: process.env.LOG_LEVEL || 'info' })
  }

  _instDir(id) {
    return path.join(this.baseDir, id)
  }

  _metaPath(id) {
    return path.join(this._instDir(id), 'meta.json')
  }

  async createInstance(id, meta={}) {
    const dir = this._instDir(id)
    fs.mkdirSync(dir, { recursive: true })
    const createdAt = new Date().toISOString()
    const record = { id, status: 'created', createdAt, meta, qr: null, sock: null }
    this.instances.set(id, record)
    fs.writeFileSync(this._metaPath(id), JSON.stringify({ ...meta, createdAt }, null, 2))
    return id
  }

  list() {
    return Array.from(this.instances.values())
  }

  get(id) {
    return this.instances.get(id) || null
  }

  async updateMeta(id, patch) {
    const inst = this.get(id)
    if (!inst) return false
    const metaPath = this._metaPath(id)
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
    const next = { ...meta, ...patch }
    fs.writeFileSync(metaPath, JSON.stringify(next, null, 2))
    inst.meta = next
    return true
  }

  async start(id, app) {
    const inst = this.get(id)
    if (!inst) return false
    const dir = this._instDir(id)

    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      syncFullHistory: false,
      browser: ['SaaS Bot','Chrome','1.0.0'],
      logger: this.logger
    })

    inst.sock = sock
    inst.status = 'starting'

    const broadcast = (payload) => {
      const wss = app.get('wss')
      if (!wss) return
      const data = JSON.stringify({ instanceId: id, ...payload })
      wss.clients.forEach((client) => {
        try { client.send(data) } catch (_e){}
      })
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) {
        inst.qr = qr
        broadcast({ type: 'qr', qr })
      }
      if (connection === 'open') {
        inst.status = 'connected'
        inst.qr = null
        broadcast({ type: 'status', status: 'connected' })
        this.logger.info({ id }, 'instance connected')
      } else if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        const reason = lastDisconnect?.error?.message || code
        inst.status = 'disconnected'
        broadcast({ type: 'status', status: 'disconnected', reason })
        this.logger.warn({ id, reason }, 'instance disconnected')
        // auto-reconnect
        if (code !== DisconnectReason.loggedOut) {
          setTimeout(()=> this.start(id, app), 3000)
        }
      }
    })

    sock.ev.on('creds.update', saveCreds)

    // Inbound messages
    sock.ev.on('messages.upsert', async (m) => {
      try {
        const webhook = inst.meta?.webhook || process.env.WEBHOOK_DEFAULT
        if (!webhook) return
        await axios.post(webhook, m, { timeout: 5000 })
      } catch (e) {
        this.logger.warn({ id, err: e.message }, 'webhook post failed')
      }
    })

    return true
  }

  async sendText(id, to, text) {
    const inst = this.get(id)
    if (!inst || !inst.sock) throw new Error('Instance not started')
    const jid = this._normalizeJid(to)
    const res = await inst.sock.sendMessage(jid, { text })
    return res
  }

  _normalizeJid(num) {
    const digits = (''+num).replace(/\D/g,'')
    // default to BR if no country code; adapt as needed
    const withCC = digits.length <= 11 ? `55${digits}` : digits
    return `${withCC}@s.whatsapp.net`
  }

  async remove(id) {
    const inst = this.get(id)
    if (!inst) return false
    try {
      if (inst.sock) await inst.sock.logout().catch(()=>{})
    } catch(_e){}
    this.instances.delete(id)
    // remove folder
    const dir = this._instDir(id)
    fs.rmSync(dir, { recursive: true, force: true })
    return true
  }
}
