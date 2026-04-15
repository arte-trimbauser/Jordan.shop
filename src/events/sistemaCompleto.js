const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, StreamType, NoSubscriberBehavior 
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

const CONFIG = {
    CANAL_VOZ_ID: "1492521949736472757",
    CANAL_TICKET_ID: "1493942678612869311",
    CANAL_FORMULARIO_ID: "1490783323780419664",
    CATEGORIA_TICKETS_ID: "1490783459470475414",
    AUDIO_PATH: path.join(__dirname, '../../JordanShop.mp3')
};

let player = null;
let conexaoVoz = null;

// --- SISTEMA DE ÁUDIO ---

async function entrarCanalVoz(client) {
    const guild = client.guilds.cache.first();
    const canal = await guild.channels.fetch(CONFIG.CANAL_VOZ_ID);
    if (!canal) return;

    conexaoVoz = joinVoiceChannel({
        channelId: canal.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
    });

    tocarMusica();
}

function tocarMusica() {
    if (!fs.existsSync(CONFIG.AUDIO_PATH)) return console.error("❌ Ficheiro JordanShop.mp3 não encontrado!");

    if (!player) {
        player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
        
        // LOOP INFINITO: Quando termina, toca outra vez
        player.on(AudioPlayerStatus.Idle, () => {
            console.log("🔄 Música terminada, a reiniciar loop...");
            tocarMusica();
        });
    }

    const recurso = createAudioResource(CONFIG.AUDIO_PATH, { inputType: StreamType.Arbitrary, inlineVolume: true });
    recurso.volume.setVolume(0.5);
    player.play(recurso);
    conexaoVoz.subscribe(player);
}

// --- EVITAR MENSAGENS DUPLICADAS ---

async function enviarMensagemUnica(canal, embed, componentes) {
    const mensagens = await canal.messages.fetch({ limit: 10 });
    const jaExiste = mensagens.find(m => m.embeds[0]?.title === embed.data.title);

    if (jaExiste) {
        await jaExiste.edit({ embeds: [embed], components: componentes });
    } else {
        await canal.send({ embeds: [embed], components: componentes });
    }
}

// --- INICIALIZAÇÃO DE EMBEDS ---

async function enviarEmbedSuporte(client) {
    const canal = await client.channels.fetch(CONFIG.CANAL_TICKET_ID);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('🎫 Suporte - Jordan Shop')
        .setDescription('Escolha o seu idioma para abrir um ticket:\n\n🇵🇹 Português\n🇪🇸 Español\n🇬🇧 English')
        .setColor('#8b0000');

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('menu_suporte_idioma')
            .setPlaceholder('Escolhe o teu idioma')
            .addOptions([
                { label: 'Português', value: 'pt', emoji: '🇵🇹' },
                { label: 'Español', value: 'es', emoji: '🇪🇸' },
                { label: 'English', value: 'en', emoji: '🇬🇧' }
            ])
    );

    await enviarMensagemUnica(canal, embed, [menu]);
}

async function enviarFormularios(client) {
    const canal = await client.channels.fetch(CONFIG.CANAL_FORMULARIO_ID);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('📋 Centro de Feedback')
        .setDescription('Reporta bugs ou dá sugestões abaixo.')
        .setColor('#8b0000');

    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('form_bug').setLabel('🐛 Bug').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('form_ideia').setLabel('💡 Ideia').setStyle(ButtonStyle.Primary)
    );

    await enviarMensagemUnica(canal, embed, [botoes]);
}

module.exports = { entrarCanalVoz, enviarEmbedSuporte, enviarFormularios, tocarMusica, player };
