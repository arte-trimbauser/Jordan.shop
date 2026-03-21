// --- BOT DISCORD ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// Evento principal que carrega os outros ficheiros
client.on(Events.ClientReady, (c) => {
    try {
        // 1. Carregar o Interaction System (Tickets/Termos)
        const interactionPath = path.join(__dirname, "src", "events", "interactionCreate.js");
        if (fs.existsSync(interactionPath)) {
            require(interactionPath)(client);
            console.log("✅ Interaction System carregado com sucesso.");
        }
        
        // 2. Carregar o Ready System (Status Rotativo/Logs)
        const readyPath = path.join(__dirname, "src", "events", "ready.js");
        if (fs.existsSync(readyPath)) {
            const readyEvent = require(readyPath);
            if (typeof readyEvent === "function") {
                readyEvent(client); 
            }
        }
    } catch (e) {
        console.warn("⚠️ Erro ao carregar eventos da pasta src/events:", e.message);
    }
});

// --- INICIAR SERVIDOR ---
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

// --- LOGIN DO BOT ---
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token não encontrado!");
} else {
    client.login(TOKEN).catch(err => console.error("❌ ERRO NO LOGIN:", err.message));
}
