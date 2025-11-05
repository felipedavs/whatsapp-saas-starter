import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";

const sessions = {}; // Guardar as conexões ativas

// Criar nova sessão
export async function createSession(sessionId, res) {
  const sessionPath = `./sessions/${sessionId}`;
  if (!fs.existsSync("./sessions")) fs.mkdirSync("./sessions");

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log(`🟡 QR Code gerado para ${sessionId}`);
      const qrImage = await qrcode.toDataURL(qr);
      res.send({ sessionId, qr: qrImage });
    }

    if (connection === "open") {
      console.log(`✅ Sessão ${sessionId} conectada!`);
      sessions[sessionId] = sock;
      await saveCreds();
    } else if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log(`❌ Sessão ${sessionId} desconectada.`);
        delete sessions[sessionId];
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
  return sock;
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
