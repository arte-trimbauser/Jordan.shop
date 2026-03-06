require("dotenv").config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 10000;

const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET; // No Render Environment
const REDIRECT_URI = 'https://jordan-shop-site.onrender.com/callback';
const GUILD_ID = '1393629457599828040';

app.use(express.static(path.join(__dirname, '/')));

// API para ler logs (Se o site estiver no mesmo servidor que os logs)
app.get('/api/transcripts', (req, res) => {
    const pasta = path.resolve(__dirname, 'transcripts');
    if (!fs.existsSync(pasta)) return res.json([]);
    const files = fs.readdirSync(pasta).filter(f => f.endsWith('.html'));
    res.json(files);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

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
        if (isMember && (BigInt(isMember.permissions) & 0x8n) === 0x8n) {
            res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            res.send('<h1 style="color:red;">❌ Acesso Negado: Apenas Administradores!</h1>');
        }
    } catch (e) { res.send('<h1>❌ Erro no Login.</h1>'); }
});

app.listen(port, () => console.log('🌐 Site Online na porta ' + port));
