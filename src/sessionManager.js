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

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`📲 QR Code gerado para ${sessionId}`);
        res.status(200).send({ sessionId, qr });
      }

      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso.`);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`⚠️ Sessão ${sessionId} desconectada: ${reason}`);

        if (reason !== DisconnectReason.loggedOut) {
          console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
          createSession(sessionId, res);
        } else {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          delete sessions[sessionId];
        }
      }
    });
  } catch (err) {
    console.error("❌ Erro ao criar sessão:", err);
    res.status(500).send({ error: "Erro ao criar sessão" });
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

// Exportar funções principais
