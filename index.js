require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 10000;

// --- 1. DEFINIÇÃO DO CLIENT PRIMEIRO ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// --- CONFIGURAÇÃO SUPABASE ---
const supabase = createClient(
    'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

const ID_CANAL_LOGS = "1437076921627181228";

const staffAutorizado = {
    "924344854232834068": "Jordan Costa",
    "996454465555136675": "Arteex26",
    "1476260824669618307": "lucasvieira",
    "1138795786507919410": "migueldodrip",
    "886007990942052362": "pincher11"
};

let tokensAtivos = new Set();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'site'), { index: false }));

// --- ROTAS DE LOGIN ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'login.html'));
});

app.post('/api/login-manual', async (req, res) => {
    const { username, password } = req.body;
    const loginValido = 
        (username === "Jordan Costa" && password === "Jordan26Costa") ||
        (username === "Arteex26" && password === "Arteex_26") ||
        (username === "lucasvieira0453" && password === "lucasvieira") ||
        (username === "migueldodrip_09110" && password === "migueldodrip") ||
        (username === "pincher11" && password === "pincher11");

    if (loginValido) {
        const tokenSessao = Math.random().toString(36).substring(2, 15);
        tokensAtivos.add(tokenSessao);

        const canalLogsLogin = await client.channels.fetch(ID_CANAL_LOGS).catch(() => null);
        if (canalLogsLogin) {
            canalLogsLogin.send(`🔐 **[SISTEMA]** O utilizador **${username}** entrou no painel de controlo.`);
        }

        return res.json({ success: true, user: username, token: tokenSessao });
    } else {
        return res.status(401).json({ success: false, message: "Utilizador ou Password incorretos!" });
    }
});

// --- API: ENVIAR EMBED ---
app.post('/api/enviar-embed', async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body;
    if (!titulo || !desc || !canalId) return res.status(400).send("Faltam campos.");
    try {
        const canal = await client.channels.fetch(canalId);
        if (!canal) return res.status(404).send("Canal não encontrado.");
        const embed = new EmbedBuilder().setTitle(titulo).setDescription(desc).setColor(cor || "#8b0000");
        const components = [];
        if (produtos && produtos.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_produtos')
                .setPlaceholder('Escolhe uma opção')
                .addOptions(produtos.map(p => ({
                    label: p.nome,
                    description: `Preço: ${p.preco}`,
                    value: `prod_${p.nome.replace(/\s+/g, '_').toLowerCase()}`
                })));
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
        await canal.send({ embeds: [embed], components: components });
        res.status(200).send("✅ Enviado!");
    } catch (error) {
        res.status(500).send("Erro no Discord.");
    }
});

// --- FUNÇÃO DE INICIALIZAÇÃO ---
const inicializarBot = () => {
    try {
        // 1. Carregar o Ready (O teu foco agora)
        const readyPath = path.join(__dirname, "src", "events", "ready.js");
        if (fs.existsSync(readyPath)) {
            const readyEvent = require(readyPath);
            if (typeof readyEvent === "function") {
                // Registamos o evento ANTES do login para ele não falhar
                client.once(Events.ClientReady, (...args) => readyEvent(client, ...args));
                console.log("✅ Evento Ready preparado para disparar.");
            }
        }

        // 2. Carregar Interações
        const interactionPath = path.join(__dirname, "src", "events", "interactionCreate.js");
        if (fs.existsSync(interactionPath)) {
            require(interactionPath)(client);
            console.log("✅ Sistema de Interações carregado.");
        }
    } catch (e) {
        console.warn("⚠️ Erro ao configurar eventos:", e.message);
    }
};

// Preparar os eventos e ligar o servidor
inicializarBot();

app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

// --- LOGIN FINAL ---
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token não encontrado!");
} else {
    client.login(TOKEN).catch(err => {
        console.error("❌ ERRO NO LOGIN DO DISCORD:", err.message);
    });
}
