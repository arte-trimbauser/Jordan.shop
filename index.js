require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÃO DE MIDDLEWARE ---
app.use(express.json()); // Essencial para receber os dados do formulário de Embed

// --- CONFIGURAÇÃO DE PASTAS ---
const sitePath = path.join(__dirname, "site");
const transcriptsPath = path.join(__dirname, "transcripts");

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

// --- ROTA DA API PARA O CRIADOR DE EMBEDS ---
app.post('/api/enviar-embed', async (req, res) => {
    const { titulo, desc, cor, canalId } = req.body;

    if (!titulo || !desc || !canalId) {
        return res.status(400).send("Faltam campos obrigatórios no formulário.");
    }

    try {
        const canal = await client.channels.fetch(canalId);
        if (!canal) return res.status(404).send("Canal não encontrado.");

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(cor || "#8b0000")
            .setTimestamp()
            .setFooter({ text: 'Painel Staff | Jordan Shop', iconURL: client.user.displayAvatarURL() });

        await canal.send({ embeds: [embed] });
        res.status(200).send("✅ Enviado com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao enviar embed:", error);
        res.status(500).send("Erro ao comunicar com o Discord.");
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

// Evento Ready corrigido
client.on('ready', (c) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`✅ Bot online como: ${c.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    c.user.setPresence({
        activities: [{ name: 'Jordan Shop | discord.gg/6hhZeqb7Qk', type: ActivityType.Competing }],
        status: 'online',
    });

    // Carregar eventos externos
    try {
        require("./src/events/interactionCreate")(client);
        const readyEvent = require("./src/events/ready");
        if (typeof readyEvent === "function") readyEvent(client);
    } catch (e) {
        console.warn("⚠️ Alguns eventos externos não foram carregados.");
    }
});

// --- INICIAR SERVIDOR ---
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Site ativo na porta ${port}`);
});

// --- LOGIN DO BOT ---
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token do bot não encontrado no .env!");
} else {
    client.login(TOKEN).catch(err => console.error("❌ ERRO NO LOGIN:", err.message));
}
