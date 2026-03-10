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

if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

app.use(express.static(sitePath));
app.use("/transcripts", express.static(transcriptsDir));

// API para listar transcripts
app.get("/api/transcripts", (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) return res.json([]);
        res.json(files.filter(f => f.endsWith(".html")).map(f => ({ name: f, url: `/transcripts/${f}` })));
    });
});

// LOGIN DISCORD (OAUTH2)
app.get("/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/?error=no_code");

    try {
        const tokenRes = await axios.post("https://discord.com/api/oauth2/token", 
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: REDIRECT_URI,
                scope: "identify guilds.members.read"
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const token = tokenRes.data.access_token;

        const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${token}` }
        });

        const memberRes = await axios.get(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const roles = memberRes.data.roles || [];
        if (roles.includes(REQUIRED_ROLE_ID)) {
            return res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
        } else {
            return res.redirect("/?error=no_role");
        }
    } catch (e) {
        console.error("❌ Erro OAuth:", e.response?.data || e.message);
        res.status(500).send("Erro no login Discord. Tenta novamente em 30 segundos.");
    }
});

// BOT DISCORD
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers
    ] 
});

require("./src/events/interactionCreate")(client);

client.once("ready", () => {
    console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

// INICIAR SERVIDOR COM O TEU VISUAL
// INICIAR SERVIDOR
app.listen(port, "0.0.0.0", () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Site está online!\n");
    console.log("O site foi iniciado com sucesso e está pronto para uso.\n");
    console.log(`🌐 Porta: ${port}`);
    console.log(`🔗 https://discord-bott-jordan.onrender.com`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
