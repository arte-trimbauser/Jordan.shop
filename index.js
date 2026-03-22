require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios"); 
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, Events } = require("discord.js");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 10000;

// --- CONFIGURAÇÃO SUPABASE ---
const supabase = createClient(
    'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

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

app.post('/api/login-manual', (req, res) => {
    const { username, password } = req.body;
    if (username === "Arteex26" && password === "Arteex_26") {
        const tokenSessao = Math.random().toString(36).substring(2, 15);
        tokensAtivos.add(tokenSessao);
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
        res.status(200).send("✅ Enviado!");
    } catch (error) {
        res.status(500).send("Erro ao comunicar com o Discord.");
    }
});
// --- ROTA DE TRANSCRIPTS (PONTE SUPABASE) ---
app.get('/transcripts/:channelId', async (req, res) => {
    const { channelId } = req.params;

    try {
        // Procuramos no bucket o ficheiro que começa com o ID do canal
        const { data: files, error: listError } = await supabase.storage
            .from('transcripts')
            .list('transcripts', { search: channelId });

        if (listError || !files || files.length === 0) {
            return res.status(404).send("❌ Transcrição não encontrada ou ainda está a ser processada.");
        }

        // Pegamos no link público do ficheiro mais recente encontrado
        const { data } = supabase.storage
            .from('transcripts')
            .getPublicUrl(`transcripts/${files[0].name}`);

        if (!data || !data.publicUrl) {
            return res.status(404).send("❌ Erro ao gerar link de visualização.");
        }

        // Redireciona o utilizador para o HTML no Supabase
        res.redirect(data.publicUrl);
    } catch (err) {
        res.status(500).send("❌ Erro interno ao procurar log.");
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

client.on(Events.ClientReady, (c) => {
    try {
        const interactionPath = path.join(__dirname, "src", "events", "interactionCreate.js");
        if (fs.existsSync(interactionPath)) {
            require(interactionPath)(client);
            console.log("✅ Interaction System carregado.");
        }
        const readyPath = path.join(__dirname, "src", "events", "ready.js");
        if (fs.existsSync(readyPath)) {
            const readyEvent = require(readyPath);
            if (typeof readyEvent === "function") readyEvent(client);
        }
    } catch (e) {
        console.warn("⚠️ Erro ao carregar eventos:", e.message);
    }
});

app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${port}`);
});

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ ERRO: Token não encontrado!");
} else {
    client.login(TOKEN).catch(err => console.error("❌ ERRO NO LOGIN:", err.message));
}
