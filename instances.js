import express from "express";
import { v4 as uuidv4 } from "uuid";
import qrcode from "qrcode";
import { startSession, getSession, closeSession } from "../sessionManager.js";

const router = express.Router();

// Iniciar uma nova sessão (gera QR Code)
router.post("/start", async (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = await startSession(sessionId);

    if (session.qr) {
      const qr = await qrcode.toDataURL(session.qr);
      return res.json({ sessionId, qr });
    }

    return res.status(400).json({ error: "QR Code não disponível no momento." });
  } catch (error) {
    console.error("Erro ao iniciar sessão:", error);
    return res.status(500).json({ error: "Falha ao iniciar sessão." });
  }
});

// Consultar status da sessão
router.get("/:id/status", async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Sessão não encontrada." });
  }

  res.json({
    id: req.params.id,
    connected: session.connected || false,
  });
});

// Encerrar sessão
router.delete("/:id", async (req, res) => {
  try {
    await closeSession(req.params.id);
    res.json({ message: "Sessão encerrada com sucesso." });
  } catch (error) {
    console.error("Erro ao encerrar sessão:", error);
    res.status(500).json({ error: "Falha ao encerrar sessão." });
  }
});

export default router;
