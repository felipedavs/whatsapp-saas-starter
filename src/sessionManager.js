import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import { instances } from "./instances.js";

export async function createSession(sessionId, res) {
  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);

    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
    });

    // Se gerar um QR Code, enviar para o front em base64
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrImage = await qrcode.toDataURL(qr);
        res.send({ qr: qrImage });
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          console.log(`Sessão ${sessionId} desconectada permanentemente.`);
          instances.delete(sessionId);
        } else {
          console.log(`Sessão ${sessionId} desconectada, tentando reconectar...`);
          createSession(sessionId, res);
        }
      }

      if (connection === "open") {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso!`);
        instances.set(sessionId, sock);
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (error) {
    console.error(`Erro ao criar sessão ${sessionId}:`, error);
    res.status(500).send({ error: "Erro ao criar sessão" });
  }
}

export function getSession(sessionId) {
  return instances.get(sessionId);
}

