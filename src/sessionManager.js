import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

const sessions = {};

// Criar nova sessão e gerar QR Code
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

      // ✅ Quando gerar o QR, responde para o ChatFlow imediatamente
      if (qr) {
        console.log(`📲 QR Code gerado para ${sessionId}`);
        if (!res.headersSent) {
          res.status(200).json({
            success: true,
            sessionId,
            qr,
          });
        }
      }

      // ✅ Quando conectar com sucesso
      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso.`);
      }

      // ⚠️ Quando desconectar
      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode || "desconhecido";
        console.log(`⚠️ Sessão ${sessionId} desconectada: ${reason}`);

        // 🔁 Recriar sessão caso não tenha sido logout manual
        if (reason !== DisconnectReason.loggedOut) {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          await createSession(sessionId, { status: () => ({ json: () => {} }) }); // evita travar
        } else {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          delete sessions[sessionId];
          console.log(`🗑️ Sessão ${sessionId} removida.`);
        }
      }
    });
  } catch (err) {
    console.error("❌ Erro ao criar sessão:", err);
    if (!res.headersSent) res.status(500).json({ error: "Erro ao criar sessão" });
  }
}

// Retornar sessão ativa
export function getSession(sessionId) {
  return sessions[sessionId];
}

// Retornar todas as sessões
export function getAllSessions() {
  return Object.keys(sessions);
}

// Deletar uma sessão
export async function deleteSession(sessionId) {
  const sessionPath = `./sessions/${sessionId}`;
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });

  delete sessions[sessionId];
  console.log(`🗑️ Sessão ${sessionId} excluída com sucesso.`);
  return true;
}
