const express = require('express');
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js'); // Necessário para o bot ligar
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Corrigir o caminho da pasta (na raiz do projeto)
const transcriptsDir = path.join(__dirname, "transcripts");
if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

app.use(express.static(__dirname));

// --- ROTAS DO SITE ---
app.get('/api/transcripts', (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.status(500).json([]);
        res.json(files.filter(f => f.endsWith('.html')));
    });
});

app.get('/transcripts/:name', (req, res) => {
    const filePath = path.join(transcriptsDir, req.params.name);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send("Não encontrado.");
});

// --- LIGAR O BOT (O que falta para ele ficar online) ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 1. IMPORTA O HANDLER (Caminho corrigido para a pasta events)
const interactionHandler = require('./events/interactionCreate'); 

// 2. LIGA O BOT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 3. PASSA O CLIENT PARA O HANDLER
interactionHandler(client);

client.once('ready', () => {
    console.log(`✅ Bot ${client.user.tag} está ONLINE!`);
});

client.login(process.env.DISCORD_TOKEN);

app.listen(PORT, () => {
    console.log(`🌐 Site Jordan Shop na porta ${PORT}`);
});
