// 🔐 Webhook protegido (para integração com Base44)
router.post("/webhook", async (req, res) => {
  const token = req.headers["x-api-key"];
  const body = req.body;

  // Verifica se o token enviado pelo Base44 é válido
  if (token !== process.env.WEBHOOK_SECRET) {
    console.log("❌ Tentativa de acesso com token inválido!");
    return res.status(401).send({ error: "Token inválido" });
  }

  console.log("📩 Mensagem recebida via Webhook Base44:", body);

  // Aqui você pode tratar a mensagem e encaminhar ao Baileys ou ao cliente
  // Exemplo: repassar para o WhatsApp usando uma sessão existente
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
