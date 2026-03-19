require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÃO DE SEGURANÇA ---
const WEBHOOK_ALERTA = "https://discord.com/api/webhooks/1484243048425586718/rm3FNPNRC1qQ23sQVLwsdRWoV4qvdJNAE7GCHffUgDj88fBv7Ky_LelagWwke76o4v5Z";

// Lista VIP por ID (Segurança Máxima)
const staffAutorizado = {
    "924344854232834068": "Jordan Costa",
    "996454465555136675": "Arteex26",
    "1476260824669618307": "lucasvieira",
    "1138795786507919410": "migueldodrip",
    "886007990942052362": "pincher11"
};

// Memória para guardar os tokens de uso único
let tokensAtivos = new Set();

app.use(express.json());

// --- ROTAS ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'login.html'));
});

// Callback do Discord (Login)
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login.html?error=no_code');

    try {
        const params = new URLSearchParams({
            client_id: '1424479855466123284',
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'https://discord-bott-jordan.onrender.com/callback',
        });

        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params);
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const discordID = userRes.data.id;
        const discordUser = userRes.data.username;

        // Verifica se o ID está na Staff
        if (!staffAutorizado[discordID]) {
            return res.redirect('/login.html?error=nao_autorizado');
        }

        // Gera Token Único para este acesso
        const tokenSessao = Math.random().toString(36).substring(2, 15);
        tokensAtivos.add(tokenSessao);

        // Redireciona com ID e Token
        res.redirect(`/loja.html?user=${encodeURIComponent(discordUser)}&id=${discordID}&token=${tokenSessao}`);
    } catch (error) {
        res.redirect('/login.html?error=auth_failed');
    }
});

// Rota Protegida da Loja
app.get('/loja.html', async (req, res) => {
    const { user, id, token } = req.query;

    // Se o token existe, é a primeira entrada (Link direto do Login)
    if (token && tokensAtivos.has(token)) {
        tokensAtivos.delete(token); // Queima o token para não ser usado de novo
        return res.sendFile(path.join(__dirname, 'site', 'loja.html'));
    }

    // Se não tem token, a segurança do HTML (sessionStorage) vai tratar do resto
    res.sendFile(path.join(__dirname, 'site', 'loja.html'));
});

app.use(express.static(path.join(__dirname, 'site'), { index: false }));
// --- ROTA DA API PARA O CRIADOR DE EMBEDS ---
app.post('/api/enviar-embed', async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body; // Recebe tudo do site

    if (!titulo || !desc || !canalId) {
        return res.status(400).send("Faltam campos obrigatórios no formulário.");
    }

    try {
        // 1. Primeiro procuramos o canal
        const canal = await client.channels.fetch(canalId);
        if (!canal) return res.status(404).send("Canal não encontrado.");

        // 2. Criamos o Embed (Sem o rodapé como pediste)
        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(cor || "#8b0000")
            .setTimestamp();

        const components = [];

        // 3. Se houver produtos, criamos o Menu de Seleção
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

        // 4. Enviamos UMA ÚNICA VEZ com tudo incluído
        await canal.send({ embeds: [embed], components: components });
        
        res.status(200).send("✅ Enviado com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao enviar embed:", error);
        res.status(500).send("Erro ao comunicar com o Discord.");
    }
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

// Evento Ready corrigido
client.on('ready', (c) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Porta: ${port}`);
        console.log(`Site Online no link: https://discord-bott-jordan.onrender.com`);
    console.log(`✅ Bot online como: ${c.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    c.user.setPresence({
        activities: [{ name: 'Jordan Shop | discord.gg/6hhZeqb7Qk', type: ActivityType.Competing }],
        status: 'online',
    });

    // Carregar eventos externos
    try {
        require("./src/events/interactionCreate")(client);
        const readyEvent = require("./src/events/ready");
        if (typeof readyEvent === "function") readyEvent(client);
    } catch (e) {
        console.warn("⚠️ Alguns eventos externos não foram carregados.");
    }
});

// --- INICIAR SERVIDOR ---
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Site ativo na porta ${port}`);
});

// --- LOGIN DO BOT ---
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token do bot não encontrado no .env!");
} else {
    client.login(TOKEN).catch(err => console.error("❌ ERRO NO LOGIN:", err.message));
}
