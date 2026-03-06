const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÕES DO DISCORD OAUTH2 (DO SITE) ---
const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET; 
const REDIRECT_URI = 'https://jordan-shop-site.onrender.com/callback';
const GUILD_ID = '1393629457599828040';

// Caminhos das pastas
const sitePath = path.join(__dirname, 'site');
const transcriptsDir = path.join(__dirname, 'transcripts');

if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

// Servir ficheiros da pasta 'site' (html, imagens, etc)
app.use(express.static(sitePath));

// --- ROTAS DO SITE (FUSÃO) ---

app.get('/', (req, res) => res.sendFile(path.join(sitePath, 'login.html')));

// API para ler os logs e mostrar no site
app.get('/api/transcripts', (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.status(500).json([]);
        res.json(files.filter(f => f.endsWith('.html')));
    });
});

// Rota para abrir o ficheiro do log
app.get('/transcripts/:name', (req, res) => {
    const filePath = path.join(transcriptsDir, req.params.name);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send("Não encontrado.");
});

// Sistema de Login (OAuth2) que estava no teu index do site
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Erro: Código ausente.');
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code,
            grant_type: 'authorization_code', redirect_uri: REDIRECT_URI, scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenRes.data.access_token;
        const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${accessToken}` } });

        const isMember = guildsRes.data.find(g => g.id === GUILD_ID);
        // Verifica se é admin (perm 0x8)
        if (isMember && (BigInt(isMember.permissions) & 0x8n) === 0x8n) {
            res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            res.send('<h1 style="color:red;">❌ Acesso Negado: Apenas Administradores!</h1>');
        }
    } catch (e) { res.send('<h1>❌ Erro no Login.</h1>'); }
});

// --- CONFIGURAÇÃO DO BOT (FUSÃO) ---

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Importa o handler que está na pasta src/events
const interactionHandler = require('./src/events/interactionCreate'); 
interactionHandler(client);

client.once('ready', () => {
    console.log(`✅ [JORDAN] Bot ${client.user.tag} ONLINE!`);
});

client.login(process.env.DISCORD_TOKEN);

// Ligar o Servidor (Site)
app.listen(port, () => {
    console.log(`🌐 [JORDAN] Site Online na porta ${port}`);
});
