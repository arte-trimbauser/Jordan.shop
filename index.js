require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// Configurações de caminhos
const sitePath = path.join(__dirname, "site");
app.use(express.static(sitePath));
app.use("/transcripts", express.static(path.join(__dirname, "transcripts")));

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

// Evento quando o Bot liga (O ESTILO QUE QUERES)
client.once("ready", () => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`🔗 Link: https://discord-bott-jordan.onrender.com`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Bot online como ${client.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
});

// Carregar interações
try {
    const interactionHandler = require("./src/events/interactionCreate");
    interactionHandler(client);
} catch (err) {
    console.error("❌ Erro ao carregar interactionCreate:", err.message);
}

// Iniciar Servidor Web
app.listen(port, "0.0.0.0", () => {
    // O log do express pode ficar aqui ou ser movido para o ready do bot
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ ERRO NO LOGIN:", err.message);
});
