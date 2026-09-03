// index.js – BOT + APENAS ROTA /api/enviar-embed
require('dotenv').config();
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const path = require("path");
const fs = require("fs");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Events
} = require("discord.js");

// ==================== BOT DISCORD ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ==================== SUPABASE (para o bot, se precisar) ====================
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
    process.env.SUPABASE_URL || "https://fdbmhgcfhdnnpwuodxzh.supabase.co",
    process.env.SUPABASE_KEY
);

// ==================== CARRINHOS (para o bot) ====================
const carrinhos = new Map();
client.carrinhos = carrinhos;

// ==================== EXPRESS (APENAS PARA O ENDPOINT) ====================
const app = express();
app.use(express.json({ limit: "1mb" }));

// Health check (opcional)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Rota /api/enviar-embed (usada pelo site da Vercel)
app.post('/api/enviar-embed', async (req, res) => {
    const { titulo, desc, cor, canalId, produtos } = req.body;
    if (!titulo || !desc || !canalId) {
        return res.status(400).send('Faltam campos (titulo, desc, canalId).');
    }

    try {
        const canal = await client.channels.fetch(canalId);
        if (!canal) return res.status(404).send('Canal não encontrado.');

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(cor || '#8b0000');

        const components = [];
        if (produtos?.length) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_produtos')
                .setPlaceholder('Escolhe uma opção')
                .addOptions(produtos.map((p, i) => ({
                    label: p.nome.slice(0, 100),
                    description: `Preço: ${p.preco}`.slice(0, 100),
                    value: `prod_${p.nome.replace(/\s+/g, '_').toLowerCase()}_${i}`
                })));
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        await canal.send({ embeds: [embed], components });
        res.send('✅ Embed enviado com sucesso!');
    } catch (error) {
        console.error('Erro no /api/enviar-embed:', error);
        res.status(500).send('Erro ao enviar embed: ' + error.message);
    }
});

// ==================== INICIALIZAÇÃO DOS EVENTOS DO BOT ====================
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

        const messageCreatePath = path.join(__dirname, "src/events/messageCreate.js");
        if (fs.existsSync(messageCreatePath)) {
            const messageCreateEvent = require(messageCreatePath);
            client.on("messageCreate", (message) => messageCreateEvent(client, message));
            console.log("✅ Evento messageCreate configurado.");
        } else {
            console.warn("⚠️ messageCreate.js nao encontrado.");
        }
    } catch (e) {
        console.warn("⚠️ Erro ao configurar eventos:", e.message);
    }
};

inicializarBot();

// ==================== LOGIN DO BOT ====================
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ DISCORD_TOKEN não definido!");
    process.exit(1);
}

function iniciarBot() {
    console.log('🔄 Bot a iniciar...');
    client.login(TOKEN)
        .then(() => console.log("✅ Pedido de login enviado ao Discord"))
        .catch(err => {
            console.error("❌ ERRO NO LOGIN:", err);
            console.log("🔄 A tentar login novamente em 10 segundos...");
            setTimeout(() => iniciarBot(), 10000);
        });
}

// Reconexão automática
client.on('shardDisconnect', (event, id) => {
    console.log(`⚠️ Shard ${id} desconectado. A reconectar...`);
    setTimeout(() => iniciarBot(), 5000);
});

client.on('shardReconnecting', (id) => {
    console.log(`🔄 Shard ${id} a reconectar...`);
});

client.on('error', (error) => {
    console.error('❌ Erro no client Discord:', error);
});

// ==================== SERVIDOR HTTP ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${PORT}`);
    console.log(`✅ Rota /api/enviar-embed disponível`);
});

// Iniciar o bot
iniciarBot();
