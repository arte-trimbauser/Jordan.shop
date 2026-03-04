require("dotenv").config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// --- CONFIGURAÇÃO DO BOT ---
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], 
  partials: [Partials.Channel] 
});

const interactionCreateEvent = require("./events/interactionCreate");

client.once("ready", () => {
    console.log(`✅ Bot ${client.user.tag} Online!`);
    interactionCreateEvent(client);
});

// --- CONFIGURAÇÃO DO SITE (EXPRESS) ---
const app = express();
const port = process.env.PORT || 10000;

const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'ZIpXF6fAzxGhTaXmXFt7TLF-T_-57aq_'; 
const REDIRECT_URI = 'https://jordan-shop-site.onrender.com/callback';
const GUILD_ID = '1393629457599828040';

app.use(express.static(path.join(__dirname, '/')));

// API para listar Transcripts no site
app.get('/api/transcripts', (req, res) => {
    const pasta = path.resolve(__dirname, 'transcripts');
    if (!fs.existsSync(pasta)) return res.json([]);
    const files = fs.readdirSync(pasta).filter(f => f.endsWith('.html'));
    res.json(files);
});

// Rota de Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); 
});

// Callback do Discord (Onde verifica se é Staff)
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Erro: Código não fornecido.');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const isMember = guildsResponse.data.find(g => g.id === GUILD_ID);

        if (isMember) {
            const permissions = BigInt(isMember.permissions);
            const isAdmin = (permissions & 0x8n) === 0x8n; // Verifica Admin

            if (isAdmin) {
                res.redirect(`/loja.html?user=${encodeURIComponent(userResponse.data.username)}`);
            } else {
                res.send('<h1 style="color:red; text-align:center; margin-top:50px;">❌ Acesso Negado: Apenas Staff!</h1>');
            }
        } else {
            res.send('<h1>❌ Não estás no servidor!</h1>');
        }
    } catch (error) {
        res.send('<h1>❌ Erro ao validar login.</h1>');
    }
});

app.get("/healthz", (req, res) => res.send("OK"));

// Inicia ambos
app.listen(port, () => console.log('🌐 Site na porta ' + port));
client.login(process.env.DISCORD_TOKEN);
