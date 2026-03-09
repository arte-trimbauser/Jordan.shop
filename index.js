require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// CONFIGURAÇÃO OFICIAL
const CLIENT_ID = "1424479855466123284";
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://discord-bott-jordan.onrender.com/callback";
const GUILD_ID = "1393629457599828040";
const REQUIRED_ROLE_ID = "1393658313006383176";

const sitePath = path.join(__dirname, "site");
const transcriptsDir = path.join(__dirname, "transcripts");

/* --- CORREÇÃO ENOTDIR: Garante que transcripts é uma PASTA --- */
if (fs.existsSync(transcriptsDir)) {
    const stats = fs.lstatSync(transcriptsDir);
    if (!stats.isDirectory()) {
        console.log("⚠️ Removendo ficheiro inválido para criar pasta 'transcripts'...");
        fs.unlinkSync(transcriptsDir);
        fs.mkdirSync(transcriptsDir, { recursive: true });
    }
} else {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

// Servir ficheiros do site e da pasta de logs
app.use(express.static(sitePath));
app.use("/transcripts", express.static(transcriptsDir));

/* Rota Principal */
app.get("/", (req, res) => {
    res.sendFile(path.join(sitePath, "login.html"));
});

/* API para listar transcripts no site */
app.get("/api/transcripts", (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.json([]);
        const transcripts = files
            .filter((f) => f.endsWith(".html"))
            .map((f) => ({
                name: f,
                url: `/transcripts/${f}`,
            }));
        res.json(transcripts);
    });
});

/* Login Discord (OAuth2) */
app.get("/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send("Erro: Código de autorização ausente.");

    try {
        const tokenRes = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: REDIRECT_URI,
                scope: "identify guilds guilds.members.read",
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const memberRes = await axios.get(
            `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const userRoles = memberRes.data.roles;
        const permissions = BigInt(memberRes.data.permissions || 0);
        
        const hasRole = userRoles.includes(REQUIRED_ROLE_ID);
        const isAdmin = (permissions & 0x8n) === 0x8n;

        if (hasRole || isAdmin) {
            res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            res.status(403).send("<h1>❌ Acesso Negado</h1><p>Precisas do cargo de Staff no servidor.</p>");
        }
    } catch (e) {
        console.error("Erro OAuth:", e.response?.data || e.message);
        res.status(500).send("Erro no login Discord.");
    }
});

/* --- BOT DISCORD --- */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Importa os teus eventos (ready, interactionCreate, etc)
require("./src/events/interactionCreate")(client);
// Garante que os caminhos abaixo batem com os teus ficheiros
if (fs.existsSync("./src/events/ready.js")) require("./src/events/ready")(client);
if (fs.existsSync("./src/events/error.js")) require("./src/events/error")(client);

client.login(process.env.DISCORD_TOKEN);

/* Iniciar site */
app.listen(port, () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Sistema Jordan Shop Online!");
    console.log(`🌐 Porta: ${port}`);
    console.log(`🔗 Link: https://discord-bott-jordan.onrender.com`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
