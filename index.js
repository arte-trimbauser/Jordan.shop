require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// Configurações base
const sitePath = path.join(__dirname, "site");
app.use(express.static(sitePath));
app.use("/transcripts", express.static(path.join(__dirname, "transcripts")));

// Rota principal para o site abrir logo
app.get("/", (req, res) => {
    res.sendFile(path.join(sitePath, "index.html"), (err) => {
        if (err) res.status(500).send("Erro: O ficheiro index.html não existe na pasta site!");
    });
});

// Bot Discord
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// Tentar carregar os eventos (AQUI É ONDE O TICKET PODE FALHAR)
try {
    const interactionHandler = require("./src/events/interactionCreate");
    interactionHandler(client);
    console.log("✅ Sistema de Tickets Carregado");
} catch (err) {
    console.error("❌ ERRO NO FICHEIRO DE TICKETS:", err);
}

// Ligar Servidor Web
app.listen(port, "0.0.0.0", () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🚀 SITE ONLINE: https://discord-bott-jordan.onrender.com`);
    console.log(`📡 Porta: ${port}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

// Ligar Bot
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
}).catch(err => console.error("❌ ERRO LOGIN:", err.message));
