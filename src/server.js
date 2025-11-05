import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import instancesRouter from "./routes/instances.js";

// Carrega variáveis de ambiente (.env)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ===== 🧱 MIDDLEWARES =====

// CORS liberado para SaaS (pode ajustar para domínios específicos depois)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));

// Permite JSONs grandes (importante se for receber payloads grandes)
app.use(express.json({ limit: "10mb" }));

// ===== 🧩 ROTAS =====

// Rota base para teste rápido
app.get("/", (req, res) => {
  res.status(200).send({
    message: "✅ Servidor WhatsApp SaaS Starter está rodando!",
    docs: "/instances - Rotas principais de integração"
  });
});

// Rotas principais (gerenciamento de sessões)
app.use("/instances", instancesRouter);

// Healthcheck — usado pelo Render para validar se o app está ativo
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== ⚙️ TRATAMENTO DE ERROS =====

// Captura erros não tratados
app.use((err, req, res, next) => {
  console.error("❌ Erro interno:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// ===== 🚀 INICIALIZAÇÃO =====
app.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════
🚀 Server running on port ${PORT}
🌐 Environment: ${process.env.NODE_ENV || "development"}
📦 API Base URL: /instances
═══════════════════════════════════════
  `);
});
// Exporta o roteador principal
export default router;
