import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

const sessions = {};

export async function createSession(sessionId, res) {
  try {
    const sessionPath = `./sessions/${sessionId}`;
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Base44 SaaS", "Chrome", "10.0"],
    });

    sessions[sessionId] = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // ✅ Gera o QR e responde ao ChatFlow AI
      if (qr) {
        console.log(`📲 QR Code gerado para ${sessionId}`);
        if (res && !res.headersSent) {
          res.status(200).json({
            success: true,
            sessionId,
            qr,
          });
        }
      }

      // ✅ Conectou com sucesso
      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso.`);
      }

      // ⚠️ Desconectou
      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.output?.payload?.statusCode ||
          lastDisconnect?.error?.statusCode ||
          "UNKNOWN";

        console.log(`⚠️ Sessão ${sessionId} desconectada. Motivo: ${statusCode}`);

        if (statusCode !== DisconnectReason.loggedOut) {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          // Pequeno delay para evitar spam de reconexão
          setTimeout(() => {
            createSession(sessionId, { status: () => ({ json: () => {} }) });
          }, 5000);
        } else {
          console.log(`🗑️ Sessão ${sessionId} encerrada manualmente.`);
          fs.rmSync(sessionPath, { recursive: true, force: true });
          delete sessions[sessionId];
        }
      }
    });
  } catch (err) {
    console.error("❌ Erro ao criar sessão:", err);
    if (res && !res.headersSent) res.status(500).json({ error: "Erro ao criar sessão" });
  }
}

export function getSession(sessionId) {
  return sessions[sessionId];
}

export function getAllSessions() {
  return Object.keys(sessions);
}

export async function deleteSession(sessionId) {
  const sessionPath = `./sessions/${sessionId}`;
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });

  delete sessions[sessionId];
  console.log(`🗑️ Sessão ${sessionId} excluída com sucesso.`);
  return true;
}
