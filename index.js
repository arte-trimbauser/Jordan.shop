require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require("discord.js");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÃO SUPABASE ---
const supabase = createClient(
    'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

// --- CONFIGURAÇÃO DE SEGURANÇA (Teu Original) ---
const staffAutorizado = {
    "924344854232834068": "Jordan Costa",
    "996454465555136675": "Arteex26",
    "1476260824669618307": "lucasvieira",
    "1138795786507919410": "migueldodrip",
    "886007990942052362": "pincher11"
};

let tokensAtivos = new Set();
app.use(express.json());

// --- ROTAS DO SITE ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'site', 'login.html'));
});

// Login Discord (OAuth2)
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login.html?error=no_code');

    try {
        const params = new URLSearchParams({
            client_id: '1424479855466123284',
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'https://jordan-shop.onrender.com/callback', // Ajustado para o teu link
        });

        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params);
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const discordID = userRes.data.id;
        const discordUser = userRes.data.username;

        if (!staffAutorizado[discordID]) {
            return res.redirect('/login.html?error=nao_autorizado');
        }

        const tokenSessao = Math.random().toString(36).substring(2, 15);
        tokensAtivos.add(tokenSessao);

        res.redirect(`/loja.html?user=${encodeURIComponent(discordUser)}&id=${discordID}&token=${tokenSessao}`);
    } catch (error) {
        res.redirect('/login.html?error=auth_failed');
    }
});

// Rota de Transcripts (Redireciona para o Supabase)
app.get('/transcripts/:name', (req, res) => {
    const { data } = supabase.storage.from('transcripts').getPublicUrl(req.params.name);
    res.redirect(data.publicUrl);
});

app.use(express.static(path.join(__dirname, 'site'), { index: false }));

// --- API: ENVIAR EMBED COM INTERACTION (SITE -> DISCORD) ---
app.post('/api/enviar-embed', async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body;

    if (!titulo || !desc || !canalId) {
        return res.status(400).send("Faltam campos no formulário.");
    }

    try {
        const canal = await client.channels.fetch(canalId);
        if (!canal) return res.status(404).send("Canal não encontrado.");

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(cor || "#8b0000"); // Sem timestamp para ficar limpo

        const components = [];

        if (produtos && produtos.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_produtos') // ID que a tua pasta interactionCreate vai ouvir
                .setPlaceholder('Escolhe uma opção')
                .addOptions(produtos.map(p => ({
                    label: p.nome,
                    description: `Preço: ${p.preco}`,
                    value: `prod_${p.nome.replace(/\s+/g, '_').toLowerCase()}`
                })));

            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

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

client.on('ready', (c) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Site: https://jordan-shop.onrender.com/`);
    console.log(`✅ Bot online como: ${c.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    c.user.setPresence({
        activities: [{ name: 'Jordan Shop | discord.gg/6hhZeqb7Qk', type: ActivityType.Competing }],
        status: 'online',
    });

    // CARREGAR EVENTOS DA PASTA SRC
    try {
        // Importante: Passamos o client para o ficheiro de interações
        require("./src/events/interactionCreate")(client);
        
        const readyEvent = require("./src/events/ready");
        if (typeof readyEvent === "function") readyEvent(client);
    } catch (e) {
        console.warn("⚠️ Nota: Alguns eventos da pasta src não foram carregados ou o ficheiro interactionCreate não exporta uma função.");
    }
});

// --- INICIAR SERVIDOR ---
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

// --- LOGIN DO BOT ---
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token não encontrado!");
} else {
    client.login(TOKEN).catch(err => console.error("❌ ERRO NO LOGIN:", err.message));
}
