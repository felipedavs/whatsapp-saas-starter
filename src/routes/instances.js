import express from "express";
import { createSession, getSession } from "../sessionManager.js";

const router = express.Router();

// Criar nova sessão e gerar QR Code
router.post("/create", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).send({ error: "sessionId é obrigatório" });

  console.log(`🚀 Criando nova sessão: ${sessionId}`);
  await createSession(sessionId, res);
});

// Enviar mensagem via sessão existente
router.post("/send-message", async (req, res) => {
  const { sessionId, number, message } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).send({ error: "Sessão não encontrada" });

  try {
    await session.sendMessage(`${number}@s.whatsapp.net`, { text: message });
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// 🔐 Webhook protegido (para integração com Base44)
router.post("/webhook", async (req, res) => {
  const token = req.headers["x-api-key"];
  const body = req.body;

  if (token !== process.env.WEBHOOK_SECRET) {
    console.log("❌ Tentativa de acesso com token inválido!");
    return res.status(401).send({ error: "Token inválido" });
  }

  console.log("📩 Mensagem recebida via Webhook Base44:", body);

  if (body.sessionId && body.number && body.message) {
    const session = getSession(body.sessionId);
    if (session) {
      await session.sendMessage(`${body.number}@s.whatsapp.net`, { text: body.message });
      console.log(`✅ Mensagem enviada para ${body.number} via sessão ${body.sessionId}`);
    } else {
      console.log(`⚠️ Sessão ${body.sessionId} não encontrada.`);
    }
  }

  res.status(200).send({ success: true });
});

export default router;
