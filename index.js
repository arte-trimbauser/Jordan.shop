// index.js – BOT + API /api/enviar-embed + /api/menus + /api/emojis
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

// ⭐ Torna o client acessível globalmente (usado pelas rotas /api/emojis)
global.client = client;

// ==================== SUPABASE ====================
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
    process.env.SUPABASE_URL || "https://fdbmhgcfhdnnpwuodxzh.supabase.co",
    process.env.SUPABASE_KEY
);

// ==================== CARRINHOS ====================
const carrinhos = new Map();
client.carrinhos = carrinhos;

// ==================== EXPRESS ====================
const app = express();
app.use(express.json({ limit: "1mb" }));

// ⭐ CORS (para poderes testar no browser directamente)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/', (req, res) => {
    res.send('🚀 Jordan Shop Bot API - Online!');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ============================================================
// API: /api/enviar-embed
// ============================================================
app.post('/api/enviar-embed', async (req, res) => {
    const {
        titulo,
        desc,
        cor,
        canalId,
        produtos,
        imagem,
        tipoImagem,
        footerTexto,
        footerIcone,
        timestamp
    } = req.body;

    console.log("📥 /api/enviar-embed body:", {
        titulo, canalId, temImagem: !!imagem, tipoImagem,
        qtdProdutos: produtos?.length || 0
    });

    if (!titulo || !desc || !canalId) {
        return res.status(400).send('Faltam campos obrigatórios (titulo, desc, canalId).');
    }

    try {
        const canal = await client.channels.fetch(canalId).catch(() => null);
        if (!canal) {
            console.error(`❌ Canal ${canalId} não encontrado`);
            return res.status(404).send('Canal não encontrado.');
        }

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(cor || '#8b0000');

        // ========== IMAGEM ==========
        if (imagem && tipoImagem !== 'none') {
            const urlLimpa = String(imagem).trim();
            if (urlLimpa.startsWith('http')) {
                if (tipoImagem === 'thumbnail') {
                    embed.setThumbnail(urlLimpa);
                } else {
                    embed.setImage(urlLimpa);
                }
            }
        }

        // ========== FOOTER ==========
        if (footerTexto || footerIcone) {
            const footerObj = { text: footerTexto || '' };
            if (footerIcone && footerIcone.startsWith('http')) {
                footerObj.iconURL = footerIcone;
            }
            embed.setFooter(footerObj);
        } else if (tipoImagem === 'footer' && imagem) {
            embed.setFooter({ text: 'Jordan Shop', iconURL: imagem });
        }

        // ========== TIMESTAMP ==========
        if (timestamp === true) {
            embed.setTimestamp();
        }

        // ========== SELECT MENU ==========
        const components = [];
        if (produtos?.length) {
            const menusLocais = require('./src/menus');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_produtos')
                .setPlaceholder('Escolhe uma opção')
                .addOptions(
                    produtos.slice(0, 25).map((p, i) => {
                        const nomeLower = String(p.nome).toLowerCase();
                        const menuReal = menusLocais.find(m => {
                            const tituloLimpo = (m.title || '')
                                .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
                                .trim()
                                .toLowerCase();
                            if (tituloLimpo && nomeLower.includes(tituloLimpo)) return true;
                            return m.options?.some(o =>
                                String(o.label || '').toLowerCase() === nomeLower
                            );
                        });

                        const valueFinal = menuReal?.id
                            || `prod_${String(p.nome).replace(/\s+/g, '_').toLowerCase()}_${i}`;

                        return {
                            label: String(p.nome).slice(0, 100),
                            description: `Preço: ${p.preco}`.slice(0, 100),
                            value: valueFinal
                        };
                    })
                );

            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        await canal.send({ embeds: [embed], components });
        console.log(`✅ Embed enviado para #${canal.name}`);
        res.send('✅ Embed enviado com sucesso!');
    } catch (error) {
        console.error('❌ Erro no /api/enviar-embed:', error);
        res.status(500).send('Erro ao enviar embed: ' + error.message);
    }
});

// ============================================================
// ⭐ ROTAS API — MENUS, EMOJIS, MIGRAÇÃO
// ============================================================
app.use('/api/menus', require('./api/menus'));
app.use('/api/emojis', require('./api/emojis'));
app.use('/api/migrar-menus', require('./api/migrar-menus'));
app.use('/api/enviar-dm', require('./api/enviar-dm'));

// ==================== INICIALIZAÇÃO DOS EVENTOS ====================
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
        }
    } catch (e) {
        console.warn("⚠️ Erro ao configurar eventos:", e.message);
    }
};

inicializarBot();

// ==================== LOGIN ====================
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
            setTimeout(() => iniciarBot(), 10000);
        });
}

client.on('shardDisconnect', (event, id) => {
    console.log(`⚠️ Shard ${id} desconectado. A reconectar...`);
    setTimeout(() => iniciarBot(), 5000);
});

client.on('error', console.error);

// ==================== SERVIDOR HTTP ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP ativo na porta ${PORT}`);
});

iniciarBot();
