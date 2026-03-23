require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, Events } = require("discord.js");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 10000;

// --- 1. DEFINIÇÃO DO CLIENT (Movido para cima para as rotas o encontrarem) ---
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

// Canal de logs que definiste
const ID_CANAL_LOGS = "1437076921627181228";

// --- CONFIGURAÇÃO DE SEGURANÇA ---
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

        // LOG DE LOGIN NO DISCORD
        const canalLogsLogin = await client.channels.fetch(ID_CANAL_LOGS).catch(() => null);
        if (canalLogsLogin) {
            canalLogsLogin.send(`🔐 **[SISTEMA]** O utilizador **${username}** acabou de entrar no painel de controlo da Jordan Shop.`);
        }

        return res.json({ success: true, user: username, token: tokenSessao });
    } else {
        return res.status(401).json({ success: false, message: "Utilizador ou Password incorretos!" });
    }
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

        // LOG DE ENVIO DE EMBED NO DISCORD
        const canalLogsStaff = await client.channels.fetch(ID_CANAL_LOGS).catch(() => null);
        if (canalLogsStaff) {
            canalLogsStaff.send(`📦 **[PAINEL]** O embed de produtos foi enviado para o canal <#${canalId}>.`);
        }

        res.status(200).send("✅ Enviado!");
    } catch (error) {
        res.status(500).send("Erro ao comunicar com o Discord.");
    }
});

// --- API: LISTAR TRANSCRIPTS ---
app.get('/api/list-transcripts', async (req, res) => {
    try {
        const { data: files, error } = await supabase.storage
            .from('transcripts')
            .list('transcripts', {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (error) throw error;
        const logs = files.filter(f => f.name.endsWith('.html') && f.name !== ".gitkeep");
        res.json(logs);
    } catch (err) {
        console.error("Erro ao listar logs:", err.message);
        res.status(500).json({ error: "Erro ao procurar logs no Supabase" });
    }
});

// --- ROTA DE VISUALIZAÇÃO ---
app.get('/transcripts/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const { data: files, error: listError } = await supabase.storage
            .from('transcripts')
            .list('transcripts', { search: channelId });

        if (listError || !files || files.length === 0) {
            return res.status(404).send("❌ Transcrição não encontrada.");
        }

        const { data, error: downloadError } = await supabase.storage
            .from('transcripts')
            .download(`transcripts/${files[0].name}`);

        if (downloadError) throw downloadError;
        const conteudoHTML = await data.text();
        res.setHeader('Content-Type', 'text/html');
        res.send(conteudoHTML);
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Erro ao processar o log.");
    }
});

// --- INICIALIZAR BOT (VERSÃO FINAL CORRIGIDA) ---
const inicializarBot = () => {
    try {
        // 1. Carregar Sistema de Interações
        const interactionPath = path.join(__dirname, "src", "events", "interactionCreate.js");
        if (fs.existsSync(interactionPath)) {
            require(interactionPath)(client);
            console.log("✅ Sistema de Interações preparado.");
        }

        // 2. Carregar o Evento Ready
        const readyPath = path.join(__dirname, "src", "events", "ready.js");
        if (fs.existsSync(readyPath)) {
            const readyEvent = require(readyPath);
            if (typeof readyEvent === "function") {
                client.once(Events.ClientReady, (...args) => readyEvent(client, ...args));
                console.log("✅ Evento Ready configurado.");
            }
        }

        // 3. Carregar Sistema de Notificações (DM Staff -> Cliente)
        const messagePath = path.join(__dirname, "src", "events", "messageCreate.js");
        if (fs.existsSync(messagePath)) {
            client.on("messageCreate", (message) => {
                try {
                    require(messagePath)(client, message);
                } catch (err) {
                    console.error("⚠️ Erro no messageCreate:", err.message);
                }
            });
            console.log("✅ Sistema de Notificações Staff -> Cliente ativo.");
        }
    } catch (e) {
        console.warn("⚠️ Erro ao configurar eventos:", e.message);
    }
};

// Chama a função para preparar os eventos
inicializarBot();

// --- INICIAR SERVIDOR HTTP ---
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

// --- LOGIN DO DISCORD ---
const TOKEN_BOT = process.env.TOKEN || process.env.DISCORD_TOKEN;

if (!TOKEN_BOT) {
    console.error("❌ ERRO: Token não encontrado!");
} else {
    client.login(TOKEN_BOT).catch((err) => {
        console.error("❌ ERRO NO LOGIN DO DISCORD:", err.message);
    });
}
