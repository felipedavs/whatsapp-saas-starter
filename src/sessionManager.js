import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";
import https from "https";

const sessions = {};

// ===============================================================
// 🚀 LIMPA TODAS AS SESSÕES ANTIGAS AO INICIAR O SERVIDOR
// ===============================================================
(() => {
  const baseDir = "./sessions";
  if (fs.existsSync(baseDir)) {
    console.log("🧹 Limpando todas as sessões antigas...");
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
  fs.mkdirSync(baseDir, { recursive: true });
})();

// ===============================================================
// 🧠 Criar nova sessão WhatsApp
// ===============================================================
export async function createSession(sessionId, res) {
  try {
    console.log(`🚀 Criando nova sessão: ${sessionId}`);

    const sessionPath = `./sessions/${sessionId}`;
    if (fs.existsSync(sessionPath)) {
      console.log(`🧹 Limpando sessão antiga: ${sessionId}`);
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Base44 SaaS", "Chrome", "10.0"],
      syncFullHistory: false,
    });

    sessions[sessionId] = sock;
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && res && !res.headersSent) {
        console.log(`📲 QR Code gerado para ${sessionId}`);
        res.status(200).send({ sessionId, qr });
      }

      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso.`);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`⚠️ Sessão ${sessionId} desconectada. Motivo: ${reason}`);

        if (reason === 405 || reason === DisconnectReason.loggedOut) {
          console.log(`🧹 Sessão ${sessionId} corrompida — limpando e recriando...`);
          fs.rmSync(sessionPath, { recursive: true, force: true });
          delete sessions[sessionId];
          setTimeout(() => createSession(sessionId), 7000);
        } else {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          setTimeout(() => createSession(sessionId), 7000);
        }
      }
    });
  } catch (err) {
    console.error(`❌ Erro ao criar sessão ${sessionId}:`, err);
    if (res && !res.headersSent) res.status(500).send({ error: "Erro ao criar sessão" });
  }
}

// ===============================================================
// 🔍 Retornar sessão ativa
// ===============================================================
export function getSession(sessionId) {
  return sessions[sessionId];
}

// ===============================================================
// 📋 Listar todas as sessões
// ===============================================================
export function getAllSessions() {
  return Object.keys(sessions);
}

// ===============================================================
// 🗑️ Deletar sessão manualmente
// ================================================
