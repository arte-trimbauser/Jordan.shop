require("dotenv").config();
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const {
    Client,
    GatewayIntentBits,
    ActivityType,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Events
} = require("discord.js");

const { createClient } = require("@supabase/supabase-js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// Carrinho global (necessário)
const carrinhos = new Map();

// ✅ STAFF AUTORIZADO
const staffAutorizado = {
    "924344854232834068": "Jordan Costa",
    "996454465555136675": "Arteex26",
    "1476260824669618307": "lucasvieira",
    "1138795786507919410": "migueldodrip",
    "886007990942052362": "pincher11"
};

let tokensAtivos = new Set();

// --- CONFIGURAÇÃO SUPABASE ---
const supabase = createClient(
    "https://fdbmhgcfhdnnpwuodxzh.supabase.co",
    process.env.SUPABASE_KEY
);

const app = express();
const port = process.env.PORT || 10000;

// ✅ HELMET - SÓ UM, O MAIS COMPLETO
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "fonts.googleapis.com",
                "cdn.jsdelivr.net",
                "cdnjs.cloudflare.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com"],
            fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://i.postimg.cc", "https://cdn.discordapp.com", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"]
        }
    }
}));

app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

app.use(express.static(path.join(__dirname, "site"), { index: false }));

// --- ROTAS ---

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "site", "login.html"));
});

// ✅ LISTAR TRANSCRIPTS (FALTAVA!)
app.get("/api/list-transcripts", async (req, res) => {
    const { data, error } = await supabase.storage
        .from("transcripts")
        .list("transcripts", { sortBy: { column: "created_at", order: "desc" } });
    
    if (error) {
        console.error("Erro Supabase list:", error.message);
        return res.status(500).json([]);
    }
    res.json(data || []);
});

// ✅ SERVIR TRANSCRIPTS - SÓ UMA ROTA!
app.get("/transcripts/:id", async (req, res) => {
    const id = req.params.id.replace('.html', '');
    const { data, error } = await supabase.storage
        .from("transcripts")
        .download(`transcripts/${id}.html`);

    if (error || !data) return res.status(404).send("Transcript não encontrado.");

    const text = await data.text();
    res.setHeader("Content-Type", "text/html");
    res.send(text);
});

// --- LOGIN MANUAL ---
app.post("/api/login-manual", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false });

    const loginValido =
        (username === "Jordan Costa" && password === "Jordan26Costa") ||
        (username === "Arteex26" && password === "Arteex_26") ||
        (username === "lucasvieira0453" && password === "lucasvieira") ||
        (username === "migueldodrip_09110" && password === "migueldodrip") ||
        (username === "pincher11" && password === "pincher11");

    if (!loginValido) return res.status(401).json({ success: false });

    const tokenSessao = Math.random().toString(36).substring(2);
    tokensAtivos.add(tokenSessao);

    try {
        const canalLogsLogin = await client.channels.fetch("1437076921627181228").catch(() => null);
        if (canalLogsLogin) {
            canalLogsLogin.send(`🔐 **[SISTEMA]** O utilizador **${username}** acabou de entrar no painel de controlo da Jordan Shop.`);
        }
    } catch {}

    res.json({ success: true, user: username, token: tokenSessao });
});

// --- CALLBACK DISCORD ---
app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect("/login.html?error=no_code");

    try {
        const params = new URLSearchParams({
            client_id: "1424479855466123284",
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: "https://jordan-shop.onrender.com/callback"
        });

        const tokenRes = await axios.post("https://discord.com/api/oauth2/token", params);
        const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const discordID = userRes.data.id;
        const discordUser = userRes.data.username;

        if (!staffAutorizado[discordID]) return res.redirect("/login.html?error=nao_autorizado");

        const tokenSessao = Math.random().toString(36).substring(2);
        tokensAtivos.add(tokenSessao);

        res.redirect(`/loja.html?user=${encodeURIComponent(discordUser)}&token=${tokenSessao}`);
    } catch {
        res.redirect("/login.html?error=auth_failed");
    }
});

// --- ENVIAR EMBED ---
app.post("/api/enviar-embed", async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body;
    if (!titulo || !desc || !canalId) return res.status(400).send("Faltam campos.");

    try {
        const canal = await client.channels.fetch(canalId);
        if (!canal) return res.status(404).send("Canal não encontrado.");

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(cor || "#8b0000");

        const components = [];
        if (produtos?.length) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("menu_produtos")
                .setPlaceholder("Escolhe uma opção")
                .addOptions(produtos.map((p, i) => ({
                    label: p.nome,
                    description: `Preço: ${p.preco}`,
                    value: `prod_${p.nome.replace(/\s+/g, "_").toLowerCase()}_${i}`
                })));
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        await canal.send({ embeds: [embed], components });
        res.send("✅ Enviado!");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao comunicar com o Discord.");
    }
});

// --- INICIALIZAÇÃO BOT ---
const inicializarBot = () => {
    try {
        const interactionPath = path.join(__dirname, "src/events/interactionCreate.js");
        if (fs.existsSync(interactionPath)) {
            require(interactionPath)(client);
            console.log("✅ Sistema de Interações preparado.");
        }

        const readyPath = path.join(__dirname, "src/events/ready.js");
        if (fs.existsSync(readyPath)) {
            const readyEvent = require(readyPath);
            if (typeof readyEvent === "function") {
                client.once(Events.ClientReady, (...args) => readyEvent(client, ...args));
                console.log("✅ Evento Ready configurado.");
            }
        }
    } catch (e) {
        console.warn("⚠️ Erro ao configurar eventos:", e.message);
    }
};

inicializarBot();

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ Token não encontrado!");
    process.exit(1);
}

// ✅ EXPRESS LIGA PRIMEIRO
app.listen(port, () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

// ✅ DEPOIS O BOT LIGA - COM LOGS DETALHADOS
console.log("🔐 A tentar login no Discord...");
console.log("Token existe?", TOKEN ? "SIM" : "NÃO");
console.log("Primeiros 20 chars:", TOKEN ? TOKEN.substring(0, 20) + "..." : "VAZIO");

client.login(TOKEN)
    .then(() => {
        console.log("✅ Pedido de login enviado ao Discord");
        console.log("Bot user:", client.user ? client.user.tag : "ainda sem user");
    })
    .catch(err => {
        console.error("❌ ERRO NO LOGIN:", err.message);
        console.error("Código do erro:", err.code);
        console.error("Erro completo:", err);
    });

// Timeout de segurança - se em 10s não ligar, avisa
setTimeout(() => {
    if (!client.user) {
        console.warn("⚠️ Atenção: Bot ainda não ligado após 10 segundos");
        console.warn("Verifica se o token está correto no Discord Developer Portal");
    }
}, 10000);

client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot ligado como ${client.user.tag}`);
});
