# WhatsApp SaaS Starter (Baileys, Multi-tenant)

Plataforma **multi-instância** para gerar **QR Code**, conectar números WhatsApp Web em **nuvem**, receber mensagens por **Webhook** e enviar mensagens via **API REST**. Ideal para criar um "Talkey/Z-API" próprio.

> **Tecnologias**: Node.js, Express, WebSocket, Baileys, Pino, QRCode

---

## 🚀 Como rodar

```bash
# 1) Baixe o projeto e instale deps
npm install

# 2) Configure variáveis (opcional)
cp .env.example .env

# 3) Start
npm run dev
# HTTP em :5173 (por padrão)
```

Health check: `GET /health` → `{ ok: true }`

WebSocket (para QR/status): `ws://localhost:5173/ws`

---

## 🔑 Fluxo básico (multi-tenant)

1. **Criar instância**  
   `POST /api/instances` → `{ "id": "..." }`

2. **Iniciar conexão** (gera QR)  
   `POST /api/instances/:id/start`

3. **Obter QR atual (dataURL)**  
   `GET /api/instances/:id/qr`  
   > Também é emitido em tempo real via WebSocket (`{ type: "qr", qr: "..." }`).

4. **Definir Webhook para mensagens recebidas**  
   `PUT /api/instances/:id/webhook`  
   ```json
   { "url": "https://meusistema.com/inbound" }
   ```

5. **Enviar mensagem**  
   `POST /api/instances/:id/sendMessage`  
   ```json
   { "to": "11999999999", "text": "Olá! 👋" }
   ```

6. **Listar / ver instâncias**  
   - `GET /api/instances`  
   - `GET /api/instances/:id`

7. **Excluir instância** (logout + remove pasta)  
   `DELETE /api/instances/:id`

---

## 🛰️ Webhook de entrada

Quando uma mensagem chega, o Baileys dispara `messages.upsert`. O servidor envia o payload bruto para o **webhook da instância** (definido via API) ou, se não existir, usa `WEBHOOK_DEFAULT` do `.env`.

> Timeout configurado em 5s. Se seu endpoint for lento, retorne 200 rapidamente e processe assíncrono.

---

## 🔌 WebSocket

Conecte em `ws://localhost:5173/ws` para receber eventos em tempo real:

- QR:  
  ```json
  { "instanceId": "...", "type": "qr", "qr": "C0DE..." }
  ```
- Status:  
  ```json
  { "instanceId": "...", "type": "status", "status": "connected" }
  ```

Você pode renderizar o QR no front com uma lib como `qrcode` ou `<img src="data:image/png;base64,...">` usando `GET /api/instances/:id/qr`.

---

## 📁 Persistência de sessões

Cada instância salva múltiplos arquivos de credencial em `./sessions/<id>/`. Ao reiniciar o servidor, basta chamar `POST /api/instances/:id/start` novamente para reconectar usando as credenciais.

> Para SaaS, crie um cron para reerguer instâncias ao subir o processo.

---

## 🧩 Observações importantes

- Este projeto usa **WhatsApp Web emulado (Baileys)** — não é a **Cloud API oficial** da Meta.
- Para produção, recomendo:
  - Balancear instâncias por processo (ou containers),
  - Usar **Redis**/fila para eventos,
  - Persistir `meta.json` em banco (Postgres/Mongo),
  - Rate limit / auth (JWT) nos endpoints,
  - Monitoramento e auto-reconnect já incluso.
- O método `_normalizeJid` assume BR (`55`) por default; ajuste ao seu público.

---

## 🛡️ Segurança

- Proteja os endpoints com **JWT** (não incluso para simplificar).
- Armazene `sessions/` em volume seguro.
- Restrinja `PUT /webhook` para domínios confiáveis.

---

## 🧠 Roadmap sugerido

- Painel React para listar instâncias, mostrar QR em tempo real e enviar mensagens.
- Suporte a mídia (áudio, imagem, PDF) no envio/recebimento.
- Conteúdos interativos (botões, listas).
- Multi-shard e limites por cliente.
- Observabilidade (Prometheus/Grafana).

---

Feito para você começar rápido com um SaaS no estilo Talkey/Z-API. Boa construção! 🚀
