import express from "express";
import { createSession, getSession } from "../sessionManager.js";

const router = express.Router();

// Criar nova instância e gerar QR Code
router.post("/create", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).send({ error: "sessionId é obrigatório" });

  console.log(`📱 Criando nova sessão: ${sessionId}`);
  await createSession(sessionId, res);
});

// Enviar mensagem (exemplo)
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

export default router;

