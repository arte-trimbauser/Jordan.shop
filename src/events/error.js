module.exports = (client) => {
  client.on("error", (err) => {
    if(err?.code==="InteractionAlreadyReplied"){ console.warn("⚠️ Interação duplicada ignorada"); return; }
    console.error("❌ Erro inesperado no cliente Discord:", err);
  });
};
