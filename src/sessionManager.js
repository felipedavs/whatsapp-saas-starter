import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";
import https from "https";

const sessions = {};

// ===============================================================
// 🧠 Função principal — Criar sessão WhatsApp
// ===============================================================
export async function createSession(sessionId, res) {
  try {
    console.log(`🚀 Criando nova sessão: ${sessionId}`);

    const sessionPath = `./sessions/${sessionId}`;
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    // Corrige erro 405 (Render/Meta)
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Base44 SaaS", "Chrome", "10.0"],
      syncFullHistory: false,
    });

    sessions[sessionId] = sock;

    sock.ev.on("creds.update", saveCreds);

    // ===========================================================
    // 🔄 Atualizações de conexão
    // ===========================================================
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`📲 QR Code gerado para ${sessionId}`);
        if (res && !res.headersSent) {
          res.status(200).send({ sessionId, qr });
        }
      }

      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso.`);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`⚠️ Sessão ${sessionId} desconectada. Motivo: ${reason}`);

        if (reason === 405 || reason === DisconnectReason.loggedOut) {
          console.log(`🧹 Sessão ${sessionId} corrompida — limpando e recriando...`);
          delete sessions[sessionId];
          fs.rmSync(sessionPath, { recursive: true, force: true });
          setTimeout(() => createSession(sessionId, res), 5000);
        } else {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          setTimeout(() => createSession(sessionId, res), 5000);
        }
      }
    });
  } catch (err) {
    console.error(`❌ Erro ao criar sessão ${sessionId}:`, err);
    if (res && !res.headersSent) {
      res.status(500).send({ error: "Erro ao criar sessão" });
    }
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
// ===============================================================
export async function deleteSession(sessionId) {
  const sessionPath = `./sessions/${sessionId}`;
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
  delete sessions[sessionId];
  console.log(`🗑️ Sessão ${sessionId} excluída com sucesso.`);
  return true;
}

// ===============================================================
// 🧩 PATCH DE ESTABILIDADE — Render / ChatFlow
// ===============================================================

setInterval(() => {
  const activeSessions = Object.keys(sessions);
  if (activeSessions.length > 0) {
    console.log(`🟢 Mantendo ${activeSessions.length} sessão(ões) ativa(s): ${activeSessions.join(", ")}`);
  } else {
    console.log("💤 Nenhuma sessão ativa no momento. Mantendo servidor acordado...");
  }
}, 1000 * 60 * 4); // a cada 4 minutos

// Força keep-alive no Render
setInterval(() => {
  https.get("https://whatsapp-saas-starter.onrender.com/health", (res) => {
    if (res.statusCode === 200) {
      console.log("🌐 Keep-alive ativo — Render acordado!");
    }
  }).on("error", (err) => {
    console.error("⚠️ Falha no keep-alive:", err.message);
  });
}, 1000 * 60 * 5); // a cada 5 minutos

console.log("✅ Patch de estabilidade de sessão carregado com sucesso.");
