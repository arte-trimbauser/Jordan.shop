require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, Events } = require("discord.js");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 10000;

// --- 1. DEFINIÇÃO DO CLIENT ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// --- 2. CONFIGURAÇÃO SUPABASE ---
const supabase = createClient(
    'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

const ID_CANAL_LOGS = "1437076921627181228";

// --- 3. CONFIGURAÇÃO DE SEGURANÇA ---
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

// --- 4. ROTAS DO EXPRESS (PAINEL WEB) ---
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
        if (canalLogsLogin) canalLogsLogin.send(`🔐 **[SISTEMA]** O utilizador **${username}** entrou no painel.`);
        return res.json({ success: true, user: username, token: tokenSessao });
    }
    return res.status(401).json({ success: false, message: "Utilizador ou Password incorretos!" });
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login.html?error=no_code');
    try {
        const params = new URLSearchParams({
            client_id: '1424479855466123284',
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'https://jordan-shop.onrender.com/callback',
        });
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params);
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        const discordID = userRes.data.id;
        const discordUser = userRes.data.username;
        if (!staffAutorizado[discordID]) return res.redirect('/login.html?error=nao_autorizado');
        const tokenSessao = Math.random().toString(36).substring(2, 15);
        tokensAtivos.add(tokenSessao);
        res.redirect(`/loja.html?user=${encodeURIComponent(discordUser)}&id=${discordID}&token=${tokenSessao}`);
    } catch (error) {
        res.redirect('/login.html?error=auth_failed');
    }
});

app.post('/api/enviar-embed', async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body;
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
        const canalLogsStaff = await client.channels.fetch(ID_CANAL_LOGS).catch(() => null);
        if (canalLogsStaff) canalLogsStaff.send(`📦 **[PAINEL]** Embed enviado para <#${canalId}>.`);
        res.status(200).send("✅ Enviado!");
    } catch (error) { res.status(500).send("Erro ao comunicar com o Discord."); }
});

// --- 5. ROTA DE TRANSCRIPTS (SUPABASE) ---
app.get('/api/list-transcripts', async (req, res) => {
    try {
        const { data: files, error } = await supabase.storage
            .from('transcripts')
            .list('transcripts', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
        if (error) throw error;
        res.json(files.filter(f => f.name.endsWith('.html')));
    } catch (err) { res.status(500).json({ error: "Erro Supabase" }); }
});

// --- 6. INICIALIZAR EVENTOS DO BOT ---
const carregarEventos = () => {
    const interactionPath = path.join(__dirname, "src", "events", "interactionCreate.js");
    if (fs.existsSync(interactionPath)) {
        require(interactionPath)(client);
        console.log("✅ Interaction System preparado.");
    }

    const readyPath = path.join(__dirname, "src", "events", "ready.js");
    if (fs.existsSync(readyPath)) {
        const readyHandler = require(readyPath);
        client.once(Events.ClientReady, (...args) => readyHandler(client, ...args));
        console.log("✅ Ready Event configurado.");
    }

    const messagePath = path.join(__dirname, "src", "events", "messageCreate.js");
    if (fs.existsSync(messagePath)) {
        client.on("messageCreate", (msg) => {
            try { require(messagePath)(client, msg); } catch(e) {}
        });
        console.log("✅ Message System ativo.");
    }
};

// --- 7. ARRANQUE FINAL ---
carregarEventos();

app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

const TOKEN_BOT = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (TOKEN_BOT) {
    client.login(TOKEN_BOT).catch(err => console.error("❌ Erro Login:", err.message));
} else {
    console.error("❌ ERRO: Token não encontrado!");
}
