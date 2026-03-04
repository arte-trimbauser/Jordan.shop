require("dotenv").config();
const { Client, GatewayIntentBits, Partials, REST, Routes } = require("discord.js");
const express = require("express");
const axios = require("axios"); // Para o Login
const path = require("path");
const fs = require("fs");

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], 
  partials: [Partials.Channel] 
});

// Importação dos teus eventos (Garante que os ficheiros existem na pasta events)
const interactionCreateEvent = require("./events/interactionCreate");

client.once("ready", () => {
    console.log(`✅ Jordan Bot Online como ${client.user.tag}`);
    interactionCreateEvent(client);
});

// --- SERVIDOR WEB ---
const app = express();

// Configurações do OAuth2 (Mete estas no Environment do Render!)
const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET; 
const REDIRECT_URI = 'https://jordan-shop-site.onrender.com/callback';
const GUILD_ID = '1393629457599828040';

// Serve os ficheiros da pasta principal (loja.html, etc) e transcripts
app.use(express.static(path.join(__dirname, '../'))); // Sobe um nível se estiver em /src
app.use('/transcripts', express.static(path.join(__dirname, '../transcripts')));

// API para listar os logs
app.get('/api/transcripts', (req, res) => {
    const pasta = path.join(__dirname, '../transcripts');
    if (!fs.existsSync(pasta)) return res.json([]);
    const ficheiros = fs.readdirSync(pasta).filter(f => f.endsWith('.html'));
    res.json(ficheiros);
});

// Rota de Login (Página inicial)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../login.html'));
});

// Callback do Discord (Verifica se é Staff)
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Erro no código.');

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenRes.data.access_token;
        const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${accessToken}` } });

        const isMember = guildsRes.data.find(g => g.id === GUILD_ID);
        if (isMember && (BigInt(isMember.permissions) & 0x8n) === 0x8n) {
            res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            res.send('<h1 style="color:red; text-align:center;">❌ Acesso Negado: Apenas Staff!</h1>');
        }
    } catch (e) {
        res.send('<h1>❌ Erro ao validar login.</h1>');
    }
});

app.get("/healthz", (req, res) => res.send("OK"));

const PORTA = process.env.PORT || 10000;
app.listen(PORTA, () => console.log(`🌐 Servidor ativo na porta ${PORTA}`));

client.login(process.env.DISCORD_TOKEN);
