require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÃO DE PASTAS ---
const sitePath = path.join(__dirname, "site");
const transcriptsPath = path.join(__dirname, "transcripts");

// Criar pasta transcripts se não existir para evitar erros de leitura
if (!fs.existsSync(transcriptsPath)) {
    fs.mkdirSync(transcriptsPath, { recursive: true });
}

app.use(express.static(sitePath));
app.use("/transcripts", express.static(transcriptsPath));

// --- CONFIGURAÇÃO DISCORD OAUTH2 ---
const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://discord-bott-jordan.onrender.com/callback';

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login.html?error=no_code');

    try {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params);
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
    } catch (error) {
        console.error("❌ Erro no Callback:", error.response?.data || error.message);
        res.redirect('/login.html?error=auth_failed');
    }
});

app.get("/", (req, res) => {
    const loginPath = path.join(sitePath, "login.html");
    res.sendFile(fs.existsSync(loginPath) ? loginPath : res.status(404).send("Erro: login.html não encontrado!"));
});

// --- BOT DISCORD ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// Evento Ready
client.once("ready", (c) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Servidor Web: http://localhost:${port}`);
    console.log(`🤖 Bot: ${c.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    c.user.setPresence({
        activities: [{ name: 'Jordan Shop | discord.gg/6hhZeqb7Qk', type: ActivityType.Competing }],
        status: 'online',
    });

    // Carregar o evento de mensagens e interações
    require("./src/events/interactionCreate")(client);
    
    // Opcional: Carregar o ready.js se tiveres lógica extra lá
    const readyEvent = require("./src/events/ready");
    if (typeof readyEvent === "function") readyEvent(client);
});

// --- INICIAR SERVIDOR ---
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Site a rodar na porta ${port}`);
});

// --- LOGIN DO BOT ---
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token do bot não encontrado no .env!");
} else {
    client.login(TOKEN).catch(err => console.error("❌ ERRO NO LOGIN:", err.message));
}
