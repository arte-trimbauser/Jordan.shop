require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// Configuração de Pastas e Transcripts
const sitePath = path.join(__dirname, "site");
const transcriptsPath = path.join(__dirname, "transcripts");

app.use(express.static(sitePath));
// Permite que o link do transcript funcione no navegador
app.use("/transcripts", express.static(transcriptsPath));

app.get("/", (req, res) => {
    const loginPath = path.join(sitePath, "login.html");
    if (fs.existsSync(loginPath)) {
        res.sendFile(loginPath);
    } else {
        res.status(404).send("Erro: login.html não encontrado!");
    }
});

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// Mensagem de Inicialização com o teu Estilo
client.once("clientReady", () => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`🔗 Link: https://discord-bott-jordan.onrender.com`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Bot online como ${client.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
});

// --- CARREGAR EVENTOS ---
// Ready
try {
    const readyHandler = require("./src/events/ready");
    readyHandler(client).catch(err => console.error("❌ Erro no readyHandler:", err.message));
} catch (err) {
    console.error("❌ Erro ao carregar ready.js:", err.message);
}

// InteractionCreate
try {
    const interactionHandler = require("./src/events/interactionCreate");
    interactionHandler(client);
} catch (err) {
    console.error("❌ Erro ao carregar interactionCreate:", err.message);
}

app.listen(port, "0.0.0.0", () => {
    // Servidor pronto
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ ERRO NO LOGIN:", err.message);
});
