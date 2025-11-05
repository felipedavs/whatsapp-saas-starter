import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import instancesRouter from "./routes/instances.js";

// Carrega variáveis de ambiente (.env)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Rota de teste
app.get("/", (req, res) => {
  res.send("✅ Servidor WhatsApp SaaS Starter está rodando!");
});

// Rotas principais (instâncias de conexão WhatsApp)
app.use("/instances", instancesRouter);

// Healthcheck (usado pelo Render)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

