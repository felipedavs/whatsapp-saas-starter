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

// Exportar tudo
export { createSession, getSession, deleteSession, getAllSessions };
