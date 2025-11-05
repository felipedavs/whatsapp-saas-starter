import express from "express";
import { createSession, getSession, deleteSession } from "../sessionManager.js";

const router = express.Router();

/**
 * 🧩 Criar nova sessão e gerar QR Code
 * Endpoint: POST /instances/create
 * Body: { "sessionId": "empresa123" }
 */
router.post("/create", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).send({ error: "sessionId é obrigatório" });
  }

  console.log(`🚀 Criando nova sessão: ${sessionId}`);
  await createSession(sessionId, res);
});

/**
 * 💬 Enviar mensagem via sessão existente
 * Endpoint: POST /instances/send-message
 * Body: { "sessionId": "empresa123", "number": "5511999999999", "message": "Olá!" }
 */
router.post("/send-message", async (req, res) => {
  const { sessionId, number, message } = req.body;

  if (!sessionId || !number || !message) {
    return res.status(400).send({ error: "sessionId, number e message são obrigatórios" });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).send({ error: "Sessão não encontrada" });
  }

  try {
    await session.sendMessage(`${number}@s.whatsapp.net`, { text: message });
    console.log(`✅ Mensagem enviada para ${number} via sessão ${sessionId}`);
    res.send({ success: true });
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err);
    res.status(500).send({ error: "Erro ao enviar mensagem" });
  }
});

/**
 * 🧹 Deletar sessão manualmente
 * Endpoint: DELETE /instances/delete
 * Body: { "sessionId": "empresa123" }
 */
router.delete("/delete", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).send({ error: "sessionId é obrigatório" });
  }

  try {
    await deleteSession(sessionId);
    res.send({ success: true, message: `Sessão ${sessionId} excluída com sucesso.` });
  } catch (err) {
    console.error("❌ Erro ao excluir sessão:", err);
    res.status(500).send({ error: "Erro ao excluir sessão" });
  }
});

/**
 * 🔐 Webhook protegido — integração com Base44
 * Header obrigatório: x-api-key: SEU_TOKEN_SECRETO
 */
router.post("/webhook", async (req, res) => {
  const token = req.headers["x-api-key"];
  const body = req.body;

  // Verifica token do Base44
  if (token !== process.env.WEBHOOK_SECRET) {
    console.log("❌ Tentativa de acesso com token inválido!");
    return res.status(401).send({ error: "Token inválido" });
  }

  console.log("📩 Mensagem recebida via Webhook Base44:", body);

  if (body.sessionId && body.number && body.message) {
    const session = getSession(body.sessionId);
    if (session) {
      try {
        await session.sendMessage(`${body.number}@s.whatsapp.net`, { text: body.message });
        console.log(`✅ Mensagem enviada para ${body.number} via sessão ${body.sessionId}`);
      } catch (err) {
        console.error(`❌ Erro ao enviar mensagem via Webhook:`, err);
      }
    } else {
      console.log(`⚠️ Sessão ${body.sessionId} não encontrada.`);
    }
  } else {
    console.log("⚠️ Webhook recebido sem dados válidos:", body);
  }

  res.status(200).send({ success: true });
});

e
