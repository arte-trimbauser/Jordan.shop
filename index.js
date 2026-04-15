require("dotenv").config();
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder 
} = require("discord.js");
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// --- IMPORTAÇÃO DOS SISTEMAS (FICHEIROS SEPARADOS) ---
const { registrarComandoChamar } = require('./src/commands/chamarCommand');
const { 
    entrarCanalVoz, 
    enviarEmbedSuporte, 
    enviarFormularios, 
    handleSistemaInteraction 
} = require('./src/events/sistemaCompleto');

const { 
    enviarVerificacao, 
    handleVerificacaoInteraction 
} = require('./src/events/sistemaVerificacao');

// --- CONFIGURAÇÃO DO CLIENTE ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates // OBRIGATÓRIO PARA ÁUDIO
    ]
});

// --- CONFIGURAÇÃO DO STAFF E TOKENS ---
const staffAutorizado = {
    "924344854232834068": "Jordan Costa",
    "996454465555136675": "Arteex26",
    "1476260824669618307": "lucasvieira",
    "1138795786507919410": "migueldodrip",
    "886007990942052362": "pincher11"
};
let tokensAtivos = new Set();

// --- CONFIGURAÇÃO WEB (EXPRESS) ---
const app = express();
const port = process.env.PORT || 10000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://i.postimg.cc", "https://cdn.discordapp.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"]
        }
    }
}));

app.use(express.json({ limit: "1mb" }));
const limiter = rateLimit({ windowMs: 60 * 1000, max: 1000 });
app.use(limiter);
app.use(express.static(path.join(__dirname, "site"), { index: false }));

// Rota principal (Login)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "site", "login.html")));

// API Login Manual
app.post("/api/login-manual", async (req, res) => {
    const { username, password } = req.body;
    const loginValido = (username === "Jordan Costa" && password === "Jordan26Costa") || (username === "Arteex26" && password === "Arteex_26");
    
    if (!loginValido) return res.status(401).json({ success: false });

    const tokenSessao = Math.random().toString(36).substring(2);
    tokensAtivos.add(tokenSessao);
    res.json({ success: true, user: username, token: tokenSessao });
});

// ==================== EVENTO READY (INICIALIZAÇÃO TOTAL) ====================

client.once(Events.ClientReady, async () => {
    console.log(`✅ Jordan Shop Online: ${client.user.tag}`);

    // 1. Áudio em Loop (JordanShop.mp3)
    try {
        await entrarCanalVoz(client);
        console.log("🎵 Áudio iniciado em loop.");
    } catch (e) { console.error("❌ Erro no Áudio:", e.message); }

    // 2. Sistema de Verificação (Envia se não houver mensagem)
    try {
        await enviarVerificacao(client);
        console.log("🛡️ Sistema de Verificação verificado.");
    } catch (e) { console.error("❌ Erro na Verificação:", e.message); }

    // 3. Suporte e Formulários
    try {
        await enviarEmbedSuporte(client);
        await enviarFormularios(client);
        console.log("🎫 Suporte e Formulários prontos.");
    } catch (e) { console.error("❌ Erro nos Embeds:", e.message); }

    // 4. Registrar Comandos Slash
    try {
        await registrarComandoChamar(client);
    } catch (e) { console.error("❌ Erro nos Comandos:", e.message); }
});

// ==================== GESTÃO DE INTERAÇÕES ====================

client.on(Events.InteractionCreate, async (interaction) => {
    // 1. Lógica de Verificação (Modal e Botão)
    try {
        await handleVerificacaoInteraction(interaction);
    } catch (e) { console.error("Erro na interacção de verificação:", e); }

    // 2. Lógica do Sistema Completo (Tickets, Idiomas, etc)
    try {
        if (typeof handleSistemaInteraction === 'function') {
            await handleSistemaInteraction(interaction, client);
        }
    } catch (e) { console.error("Erro na interacção do sistema:", e); }
});

// ==================== INICIAR SERVIDORES ====================

app.listen(port, () => {
    console.log(`🚀 Painel Web a correr na porta ${port}`);
});

client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log("📡 Conexão ao Discord estabelecida."))
    .catch(err => console.error("❌ Falha no login:", err));
