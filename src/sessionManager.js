import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

const sessions = {};

/**
 * 🔹 Criar nova sessão WhatsApp e gerar QR Code
 */
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

    // Salvar credenciais a cada atualização
    sock.ev.on("creds.update", saveCreds);

    // Escutar eventos de conexão
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // 📲 QR Code gerado — enviado para o ChatFlow AI
      if (qr) {
        console.log(`📲 QR Code gerado para ${sessionId}`);
        if (res && !res.headersSent) {
          res.status(200).json({ success: true, sessionId, qr });
        }
      }

      // ✅ Conectado com sucesso
      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso.`);
      }

      // ⚠️ Desconectado
      if (connection === "close") {
        const error = lastDisconnect?.error;
        const reason =
          error?.output?.statusCode ||
          error?.output?.payload?.statusCode ||
          error?.statusCode ||
          error?.message ||
          "desconhecido";

        console.log(`⚠️ Sessão ${sessionId} desconectada. Motivo: ${reason}`);

        // Se não foi logout, tentar reconectar com delay
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          // Delay para evitar loop frenético
          setTimeout(() => {
            createSession(sessionId, { status: () => ({ json: () => {} }) });
          }, 5000);
        } else {
          console.log(`🗑️ Sessão ${sessionId} encerrada permanentemente.`);
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

/**
 * 🔍 Retornar sessão ativa
 */
export function getSession(sessionId) {
  return sessions[sessionId];
}

/**
 * 📋 Retornar todas as sessões
 */
export function getAllSessions() {
  return Object.keys(sessions);
}

/**
 * 🧹 Deletar uma sessão
 */
export async function deleteSession(sessionId) {
  const sessionPath = `./sessions/${sessionId}`;
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });

  delete sessions[sessionId];
  console.log(`🗑️ Sessão ${sessionId} excluída com sucesso.`);
  return true;
}
