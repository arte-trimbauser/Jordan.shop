const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÕES DO DISCORD OAUTH2 ---
const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET; 
const REDIRECT_URI = 'https://jordan-shop-site.onrender.com/callback';
const GUILD_ID = '1393629457599828040';

// --- CAMINHOS DAS PASTAS ---
const sitePath = path.join(__dirname, 'site');
const transcriptsDir = path.join(__dirname, 'transcripts');

// Garante que a pasta de logs existe
if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

// --- MIDDLEWARES ---
app.use(express.static(sitePath)); // Serve HTML/CSS/JS da pasta site
app.use('/transcripts', express.static(transcriptsDir)); // Expõe a pasta de logs para o navegador

// --- ROTAS DO SITE ---

// Página Inicial (Login)
app.get('/', (req, res) => res.sendFile(path.join(sitePath, 'login.html')));

// API para listar os ficheiros na pasta transcripts
app.get('/api/transcripts', (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.status(500).json([]);
        res.json(files.filter(f => f.endsWith('.html')));
    });
});

app.get('/transcripts/:name', (req, res) => {
    const fileName = req.params.name;
    const filePath = path.join(transcriptsDir, fileName);

    // 1. Tenta encontrar o caminho exato
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }

    // 2. Se não encontrou, procura por qualquer ficheiro que contenha esse nome na pasta
    // (Isso resolve o problema do "ticket-ticket-")
    const files = fs.readdirSync(transcriptsDir);
    const foundFile = files.find(f => f.includes(fileName.replace('ticket-', '')));

    if (foundFile) {
        return res.sendFile(path.join(transcriptsDir, foundFile));
    }

    // 3. Se mesmo assim não der:
    console.log("❌ Arquivo não encontrado:", fileName);
    res.status(404).send(`
        <body style="background: #1a1a1a; color: white; text-align: center; font-family: sans-serif; padding-top: 50px;">
            <h1>404 - Log Não Encontrado</h1>
            <p>O ficheiro <b>${fileName}</b> não existe no servidor.</p>
            <p>Dica: Feche um ticket novo no Discord para gerar um log atualizado.</p>
            <a href="/" style="color: #5865F2;">Voltar ao Início</a>
        </body>
    `);
});

// Sistema de Login OAuth2
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
        // Verifica se o usuário tem permissão de Administrador (0x8)
        if (isMember && (BigInt(isMember.permissions) & 0x8n) === 0x8n) {
            res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            res.send('<h1 style="color:red; text-align:center; margin-top:50px;">❌ Acesso Negado: Apenas Administradores da Jordan Shop!</h1>');
        }
    } catch (e) { 
        console.error("Erro no login:", e);
        res.send('<h1>❌ Erro no processo de Login.</h1>'); 
    }
});

// --- CONFIGURAÇÃO DO BOT ---

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Carrega o sistema de interações (Tickets, botões, etc)
try {
    const interactionHandler = require('./src/events/interactionCreate'); 
    interactionHandler(client);
} catch (err) {
    console.error("⚠️ Erro ao carregar interactionCreate:", err.message);
}

client.once('ready', () => {
    console.log(`✅ [JORDAN] Bot ${client.user.tag} ONLINE e pronto!`);
});

client.login(process.env.DISCORD_TOKEN);

// --- INICIAR SERVIDOR ---
app.listen(port, () => {
    console.log(`🌐 [JORDAN] Site e API rodando na porta ${port}`);
});
