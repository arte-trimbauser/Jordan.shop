const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

const CLIENT_ID = "1424479855466123284";
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://discord-bott-jordan.onrender.com/callback";
const GUILD_ID = "1393629457599828040";
const REQUIRED_ROLE_ID = "1393658313006383176"; // O ID do cargo que me deste

const sitePath = path.join(__dirname, "site");
const transcriptsDir = path.join(__dirname, "transcripts");

/* cria pasta transcripts se não existir */
if (!fs.existsSync(transcriptsDir)) {
  fs.mkdirSync(transcriptsDir, { recursive: true });
}

app.use(express.static(sitePath));
app.use("/transcripts", express.static(transcriptsDir));

/* página inicial */
app.get("/", (req, res) => {
  res.sendFile(path.join(sitePath, "login.html"));
});

/* API transcripts */
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

/* abrir transcript */
app.get("/transcripts/:name", (req, res) => {
  const filePath = path.join(transcriptsDir, req.params.name);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  res.status(404).send("Transcript não encontrado");
});

/* login discord */
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) return res.send("Erro login");

  try {
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        scope: "identify guilds guilds.members.read", // Scope necessário para ver cargos
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Obtém dados básicos do utilizador
    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Obtém os dados do membro especificamente neste servidor (GUILD_ID)
    const memberRes = await axios.get(
      `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const userRoles = memberRes.data.roles; // Lista de IDs de cargos do utilizador
    const permissions = BigInt(memberRes.data.permissions);
    
    // Verifica se tem o cargo específico OU se é Administrador (0x8)
    const hasRole = userRoles.includes(REQUIRED_ROLE_ID);
    const isAdmin = (permissions & 0x8n) === 0x8n;

    if (hasRole || isAdmin) {
      res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
    } else {
      res.send("Acesso negado: Não tens o cargo necessário no servidor.");
    }
  } catch (e) {
    console.error("Erro OAuth:", e);
    res.send("Erro login Discord ou não estás no servidor.");
  }
});

/* BOT DISCORD */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

require("./src/events/interactionCreate")(client);
require("./src/events/ready")(client);
require("./src/events/error")(client);

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

/* iniciar site */

app.listen(port, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Site está online!");
  console.log("O site foi iniciado com sucesso e está pronto para uso.");
  console.log(`🌐 Porta: ${port}`);
  console.log(`🔗 https://jordan-shop-site.onrender.com`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
