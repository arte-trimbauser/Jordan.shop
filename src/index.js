const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(__dirname));
app.use(express.json());

// --- LOGIN ORIGINAL (Como tinhas antes) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `https://${req.hostname}/callback`,
            scope: 'identify guilds',
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        res.redirect(`/loja.html?user=${encodeURIComponent(userResponse.data.global_name || userResponse.data.username)}`);
    } catch (error) {
        res.status(500).send("Erro ao autenticar.");
    }
});

// --- GESTÃO DE TRANSCRIPTS (Termos originais) ---
const transcriptsDir = path.join(__dirname, "transcripts");

app.get('/api/transcripts', (req, res) => {
    if (!fs.existsSync(transcriptsDir)) return res.json([]);
    
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.status(500).json([]);
        // Mantém apenas os ficheiros .html que o bot gera
        res.json(files.filter(f => f.endsWith('.html')));
    });
});

// Rota usada pelo botão "Ver na Web" do Discord e do Site
app.get('/transcripts/:name', (req, res) => {
    const filePath = path.join(transcriptsDir, req.params.name);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("Transcript não encontrado.");
    }
});

app.listen(PORT, () => {
    console.log(`✅ Jordan Shop Online na porta ${PORT}`);
});
