require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// Configuração de Pastas
const sitePath = path.join(__dirname, "site");
const transcriptsPath = path.join(__dirname, "transcripts");

app.use(express.static(sitePath));
app.use("/transcripts", express.static(transcriptsPath));

// --- CONFIGURAÇÃO DISCORD OAUTH2 ---
const CLIENT_ID = '1424479855466123284';
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://discord-bott-jordan.onrender.com/callback';

// Rota de Callback para o Login do Discord
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login.html?error=no_code');

    try {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params);
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        res.redirect(`/loja.html?user=${encodeURIComponent(userRes.data.username)}`);
    } catch (error) {
        console.error("❌ Erro no Callback:", error.message);
        res.redirect('/login.html?error=auth_failed');
    }
});

app.get("/", (req, res) => {
    const loginPath = path.join(sitePath, "login.html");
    res.sendFile(fs.existsSync(loginPath) ? loginPath : res.status(404).send("Erro: login.html não encontrado!"));
});

// --- BOT DISCORD ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

// Mensagem de Inicialização Única e Estilizada
client.once("clientReady", (c) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`🔗 Link: https://discord-bott-jordan.onrender.com`);
    console.log(`✅ Bot online como: ${c.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
});

// Função para enviar Transcript para o GitHub
client.enviarParaGithub = async (nomeArquivo, conteudoHtml) => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/arte-trimbauser/Jordan.Shop-Bot-Site/contents/transcripts/${nomeArquivo}`;

    try {
        await axios.put(url, {
            message: `💾 Log: ${nomeArquivo}`,
            content: Buffer.from(conteudoHtml).toString('base64'),
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log(`✅ Transcript ${nomeArquivo} enviado para o GitHub!`);
    } catch (err) {
        console.error("❌ Erro ao enviar para GitHub:", err.response?.data?.message || err.message);
    }
};

// --- CARREGAR EVENTOS ---
try {
    // Comentei o readyHandler para evitar a duplicação, já que o log principal está acima
    // require("./src/events/ready")(client); 
    require("./src/events/interactionCreate")(client);
} catch (err) {
    console.error("❌ Erro ao carregar eventos:", err.message);
}

app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor Web a correr na porta ${port}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ ERRO NO LOGIN DO BOT:", err.message);
});
