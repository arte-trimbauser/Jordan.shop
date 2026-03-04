require("dotenv").config();
const { Client, GatewayIntentBits, Partials, REST, Routes } = require("discord.js");
const express = require("express");
const path = require("path");
const fs = require("fs");

// --- 1. CONFIGURAÇÃO DO BOT ---
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Importação dos teus eventos
const interactionCreateEvent = require("./events/interactionCreate");

client.once("ready", async () => {
    console.log(`✅ Bot ${client.user.tag} Online!`);
    
    // Ativa a lógica de botões e tickets
    interactionCreateEvent(client);

    // --- REGISTO DE COMANDOS SLASH (Opcional se já estiverem registados) ---
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 A atualizar comandos slash...');
        // Se tiveres uma lista de comandos, eles seriam registados aqui
        console.log('✅ Comandos prontos a usar!');
    } catch (error) {
        console.error("❌ Erro ao registar comandos:", error);
    }
});

// --- 2. SERVIDOR WEB (Logs + Health Check) ---
const app = express();
const PORTA = process.env.PORT || 10000;

// IMPORTANTE: Como o index está em /src, temos de subir uma pasta para encontrar os logs
const pastaTranscripts = path.join(__dirname, '../transcripts');

// Cria a pasta de logs se ela não existir para não dar erro
if (!fs.existsSync(pastaTranscripts)) {
    fs.mkdirSync(pastaTranscripts, { recursive: true });
}

// Torna os ficheiros HTML dos tickets acessíveis via link
app.use('/transcripts', express.static(pastaTranscripts));

// API para o site saber quais tickets existem
app.get('/api/transcripts', (req, res) => {
    try {
        const ficheiros = fs.readdirSync(pastaTranscripts).filter(f => f.endsWith('.html'));
        res.json(ficheiros);
    } catch (e) {
        res.json([]);
    }
});

// Resposta simples para o Render saber que o bot não crashou
app.get("/", (req, res) => res.send("🤖 Jordan Bot está ativo e a vigiar os tickets!"));
app.get("/healthz", (req, res) => res.send("OK"));

app.listen(PORTA, () => {
    console.log(`🌐 Servidor de logs ativo na porta ${PORTA}`);
});

// --- 3. LOGIN ---
client.login(process.env.DISCORD_TOKEN);
