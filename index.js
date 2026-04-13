// index.js - VERSÃO MÍNIMA E FUNCIONAL
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
    Events,
    REST,
    Routes
} = require("discord.js");

const { 
    entrarCanalVoz, 
    enviarEmbedSuporte, 
    enviarFormularios 
} = require('./src/events/sistemaCompleto');

const { registrarComandoChamar } = require('./src/commands/chamarCommand');

// ==================== CLIENT DISCORD ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Debug seguro (não mostra token)
client.on("debug", (info) => {
    if (info.toLowerCase().includes("token")) return;
    console.log(`[DEBUG] ${info}`);
});
client.on("error", (err) => console.error(`[ERRO] ${err.message}`));
client.on("warn", (info) => console.warn(`[AVISO] ${info}`));

// Carrinho global
client.carrinhos = new Map();

const staffAutorizado = {
    "924344854232834068": "Jordan Costa",
    "996454465555136675": "Arteex26",
    "1476260824669618307": "lucasvieira",
    "1138795786507919410": "migueldodrip",
    "886007990942052362": "pincher11"
};

let tokensAtivos = new Set();

// --- SUPABASE ---
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
    "https://fdbmhgcfhdnnpwuodxzh.supabase.co",
    process.env.SUPABASE_KEY
);

// ==================== EXPRESS ====================
const app = express();
const port = process.env.PORT || 10000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com"],
            fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://i.postimg.cc", "https://cdn.discordapp.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"]
        }
    }
}));

app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 1000 }));
app.use(express.static(path.join(__dirname, "site"), { index: false }));

// Rotas básicas
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "site", "login.html")));

app.get("/api/list-transcripts", async (req, res) => {
    const { data, error } = await supabase.storage.from("transcripts").list("transcripts", { sortBy: { column: "created_at", order: "desc" } });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.get("/transcripts/:id", async (req, res) => {
    const id = req.params.id.replace('.html', '');
    const { data, error } = await supabase.storage.from("transcripts").download(`transcripts/${id}.html`);
    if (error || !data) return res.status(404).send("Transcript não encontrado.");
    res.setHeader("Content-Type", "text/html");
    res.send(await data.text());
});

app.post("/api/login-manual", async (req, res) => {
    const { username, password } = req.body;
    const loginValido =
        (username === "Jordan Costa" && password === "Jordan26Costa") ||
        (username === "Arteex26" && password === "Arteex_26") ||
        (username === "lucasvieira0453" && password === "lucasvieira") ||
        (username === "migueldodrip_09110" && password === "migueldodrip") ||
        (username === "pincher11" && password === "pincher11");

    if (!loginValido) return res.status(401).json({ success: false });

    const tokenSessao = Math.random().toString(36).substring(2);
    tokensAtivos.add(tokenSessao);
    res.json({ success: true, user: username, token: tokenSessao });
});

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

        if (!staffAutorizado[userRes.data.id])
            return res.redirect("/login.html?error=nao_autorizado");

        const tokenSessao = Math.random().toString(36).substring(2);
        tokensAtivos.add(tokenSessao);
        res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}&token=${tokenSessao}`);
    } catch {
        res.redirect("/login.html?error=auth_failed");
    }
});

app.post("/api/enviar-embed", async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body;
    if (!titulo || !desc || !canalId) return res.status(400).send("Faltam campos.");

    try {
        const canal = await client.channels.fetch(canalId);
        const embed = new EmbedBuilder().setTitle(titulo).setDescription(desc).setColor(cor || "#8b0000");
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

// ==================== EVENTO READY ====================
client.once(Events.ClientReady, async () => {
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
    
    // Slash commands
    try {
        const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
        const adicionar = require("./src/commands/adicionar");
        const carrinho = require("./src/commands/carrinho");
        const commands = [adicionar, carrinho].filter(Boolean).map(cmd => cmd.data.toJSON());
        
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        await rest.put(Routes.applicationGuildCommands(client.user.id, "1393629457599828040"), { body: commands });
        console.log(`✅ ${commands.length} comandos registados`);
    } catch (err) {
        console.error("❌ Erro comandos:", err.message);
    }

    // Comando /chamar
    try {
        await registrarComandoChamar(client);
        console.log("✅ Comando /chamar registado");
    } catch (err) {
        console.error("❌ Erro /chamar:", err.message);
    }

    // Sistemas adicionais (voz, embeds, formulários)
    try {
        await entrarCanalVoz(client);
        await enviarEmbedSuporte(client);
        await enviarFormularios(client);
        console.log("✅ Sistemas adicionais OK");
    } catch (err) {
        console.error("❌ Erro sistemas adicionais:", err.message);
    }

    // Status
    const statusList = [
        { name: "Jordan Shop", type: ActivityType.Playing },
        { name: "Os melhores preços!", type: ActivityType.Watching }
    ];
    let i = 0;
    setInterval(() => {
        client.user.setPresence({ activities: [statusList[i]], status: "online" });
        i = (i + 1) % statusList.length;
    }, 10000);
});

// ==================== INTERACTIONS ====================
try {
    const interactionPath = path.join(__dirname, "src/events/interactionCreate.js");
    if (fs.existsSync(interactionPath)) {
        require(interactionPath)(client);
        console.log("✅ Interações carregadas");
    }
} catch (e) {
    console.warn("⚠️ Erro interações:", e.message);
}

// ==================== INICIAR ====================
app.listen(port, () => console.log(`🌐 Site na porta ${port}`));

// LOGIN DO BOT - VERIFICAÇÃO ROBUSTA
const TOKEN = process.env.DISCORD_TOKEN;

console.log("⏳ Iniciando...");

if (!TOKEN) {
    console.error("❌ ERRO: DISCORD_TOKEN não definido!");
    process.exit(1);
}

// Verificar formato do token (deve ter pelo menos 2 pontos)
const partes = TOKEN.split('.');
if (partes.length !== 3 || TOKEN.length < 50) {
    console.error("❌ ERRO: Token com formato inválido!");
    console.error("🔍 Partes encontradas:", partes.length);
    process.exit(1);
}

console.log("🔍 Token válido, a fazer login...");

client.login(TOKEN)
    .then(() => console.log("📡 Login enviado"))
    .catch(err => {
        console.error("❌ FALHA NO LOGIN:", err.message);
        process.exit(1);
    });
