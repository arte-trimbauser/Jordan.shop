require("dotenv").config();
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder 
} = require("discord.js");
const express = require("express");
const path = require("path");

// --- IMPORTAÇÃO DOS SISTEMAS ---
const { registrarComandoChamar } = require('./src/commands/chamarCommand');
const { 
    entrarCanalVoz, 
    enviarEmbedSuporte, 
    enviarFormularios, 
    handleSistemaInteraction 
} = require('./src/events/sistemaCompleto');

const { 
    enviarVerificacao, 
    handleVerificacaoInteraction 
} = require('./src/events/sistemaVerificacao');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates 
    ]
});

// ==================== EVENTO READY ====================

client.once(Events.ClientReady, async () => {
    console.log(`✅ Jordan Shop Online: ${client.user.tag}`);

    // 1. Áudio em Loop (Caminho atualizado para audio/JordanShop.mp3)
    try {
        // Passamos o caminho correto como argumento se necessário, 
        // mas a função entrarCanalVoz deve usar path.join(__dirname, 'audio', 'JordanShop.mp3')
        await entrarCanalVoz(client);
        console.log("🎵 Tentativa de iniciar áudio concluída.");
    } catch (e) { 
        console.error("❌ Erro no Áudio:", e.message); 
    }

    // 2. Sistema de Verificação
    try {
        console.log("🔍 A verificar canal de verificação...");
        await enviarVerificacao(client);
        console.log("🛡️ Comando de verificação processado.");
    } catch (e) { 
        console.error("❌ Erro na Verificação:", e.message); 
    }

    // 3. Suporte e Formulários
    try {
        await enviarEmbedSuporte(client);
        await enviarFormularios(client);
        console.log("🎫 Suporte e Formulários processados.");
    } catch (e) { 
        console.error("❌ Erro nos Embeds:", e.message); 
    }

    // 4. Registrar Comandos Slash
    try {
        await registrarComandoChamar(client);
    } catch (e) { 
        console.error("❌ Erro nos Comandos:", e.message); 
    }
});

// ==================== GESTÃO DE INTERAÇÕES ====================

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        await handleVerificacaoInteraction(interaction);
        if (typeof handleSistemaInteraction === 'function') {
            await handleSistemaInteraction(interaction, client);
        }
    } catch (e) { 
        console.error("❌ Erro numa interação:", e.message); 
    }
});

// ==================== SERVIDOR WEB E LOGIN ====================

const app = express();
app.use(express.json());
app.listen(process.env.PORT || 10000, () => console.log(`🚀 Web Server OK`));

client.login(process.env.DISCORD_TOKEN);
