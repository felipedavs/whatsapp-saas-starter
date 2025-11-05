import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";
import https from "https";
import qrcode from "qrcode-terminal";

const sessions = {};

// ===============================================================
// 🧹 LIMPA SESSÕES ANTIGAS AO INICIAR
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
// 🧠 CRIAR NOVA SESSÃO
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
      logger: pino({ level: "silent" }),
      browser: ["Base44 SaaS", "Chrome", "10.0"],
      syncFullHistory: false,
    });

    sessions[sessionId] = sock;
    sock.ev.on("creds.update", saveCreds);

    // ===========================================================
    // 🧭 ATUALIZAÇÕES DE CONEXÃO
    // ===========================================================
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`📲 QR Code gerado para ${sessionId}:`);
        qrcode.generate(qr, { small: true }); // ✅ imprime o QR manualmente
        if (res && !res.headersSent) res.status(200).send({ sessionId, qr });
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
          setTimeout(() => createSession(sessionId), 10000);
        } else {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          setTimeout(() => createSession(sessionId), 10000);
        }
      }
    });
  } catch (err) {
    console.error(`❌ Erro ao criar sessão ${sessionId}:`, err);
    if (res && !res.headersSent) res.status(500).send({ error: "Erro ao criar sessão" });
  }
}

// ===============================================================
// 🔍 GET SESSION / DELETE
// ===============================================================
export function getSession(sessionId) {
  return sessions[sessionId];
}

export async function deleteSession(sessionId) {
  const sessionPath = `./sessions/${sessionId}`;
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
  delete sessions[sessionId];
  console.log(`🗑️ Sessão ${sessionId} excluída com sucesso.`);
  return true;
}

// ===============================================================
// ⚙️ PATCH KEEP-ALIVE
// ===============================================================
setInterval(() => {
  const activeSessions = Object.keys(sessions);
  if (activeSessions.length > 0) {
    console.log(`🟢 Sessões ativas: ${activeSessions.join(", ")}`);
  } else {
    console.log("💤 Nenhuma sessão ativa no momento. Mantendo servidor acordado...");
  }
}, 1000 * 60 * 4);

setInterval(() => {
  https.get("https://whatsapp-saas-starter.onrender.com/health", (res) => {
    if (res.statusCode === 200) console.log("🌐 Keep-alive ativo — Render acordado!");
  }).on("error", (err) => {
    console.error("⚠️ Falha no keep-alive:", err.message);
  });
}, 1000 * 60 * 5);

console.log("✅ Patch de estabilidade com QR manual carregado.");

// ===============================================================
// 🚀 AUTO-INICIALIZAÇÃO
// ===============================================================
setTimeout(() => {
  console.log("🧠 Criando sessão automática de debug: empresa123");
  createSession("empresa123");
}, 8000);
