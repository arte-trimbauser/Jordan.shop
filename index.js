const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://jordan-shop-site.onrender.com/callback';
const GUILD_ID = '1393629457599828040';

const sitePath = path.join(__dirname, 'site');
const transcriptsDir = path.join(__dirname, 'transcripts');

if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

app.use(express.static(sitePath));
app.use('/transcripts', express.static(transcriptsDir));

app.get('/', (req, res) => res.sendFile(path.join(sitePath, 'login.html')));

app.get('/api/transcripts', (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.json([]);
        res.json(files.filter(f => f.endsWith('.html')));
    });
});

app.get('/transcripts/:name', (req, res) => {
    const filePath = path.join(transcriptsDir, req.params.name);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.status(404).send("Transcript não encontrado");
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Erro login');

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const isMember = guildsRes.data.find(g => g.id === GUILD_ID);

        if (isMember && (BigInt(isMember.permissions) & 0x8n) === 0x8n) {
            res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            res.send("Acesso negado");
        }

    } catch (e) {
        res.send("Erro login Discord");
    }
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

require("./src/events/interactionCreate")(client);
require("./src/events/ready")(client);
require("./src/events/error")(client);

client.once('ready', () => {
    console.log(`Bot online ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

app.listen(port, () => {
    console.log("Site online porta " + port);
});
