// src/events/sistemaCompleto.js - SISTEMA DE ÁUDIO + EMBEDS + TICKETS + FORMULÁRIOS
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');
const { 
    joinVoiceChannel, 
    getVoiceConnection,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
    NoSubscriberBehavior
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { createReadStream } = require('node:fs');

// FFmpeg static para funcionar no Render
const ffmpegPath = require('ffmpeg-static');
console.log('📁 FFmpeg path:', ffmpegPath);

// IDs dos canais
const CANAL_VOZ_ID = "1492521949736472757";
const CANAL_TICKET_ID = "1493942678612869311";
const CANAL_FORMULARIO_ID = "1490783323780419664";
const CATEGORIA_TICKETS_ID = "1490783459470475414";

// Emojis personalizados
const EMOJIS = {
    pt: "<:Flag_of_Portugal:1492525538416267536>",
    es: "<:Flag_of_Spain:1492525567889641583>",
    en: "<:Flag_of_England:1492526158309359726>"
};

// Variáveis globais para áudio
let voiceConnection = null;
let audioPlayer = null;
let currentResource = null;
let currentVolume = 0.5;
let isPlaying = false;
let currentAudioPath = null;
let currentFormat = null;

// ============================================================================
// 1. BOT ENTRA NO CANAL DE VOZ E TOCA ÁUDIO EM LOOP INFINITO
// ============================================================================

async function entrarCanalVoz(client) {
    try {
        const guild = client.guilds.cache.first();
        const canal = await guild.channels.fetch(CANAL_VOZ_ID);

        if (!canal || canal.type !== ChannelType.GuildVoice) {
            console.log('❌ Canal de voz não encontrado');
            return;
        }

        // Verificar se já está no canal
        const existingConnection = getVoiceConnection(guild.id);
        if (existingConnection) {
            console.log('ℹ️ Bot já está num canal de voz');
            return;
        }

        voiceConnection = joinVoiceChannel({
            channelId: canal.id,
            guildId: canal.guild.id,
            adapterCreator: canal.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        voiceConnection.on(VoiceConnectionStatus.Ready, () => {
            console.log('✅ Bot entrou no canal de voz:', canal.name);
            iniciarAudioAutomatico();
        });

        voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            console.log('⚠️ Bot desconectado do canal de voz');
            isPlaying = false;
        });

        voiceConnection.on('error', (err) => {
            console.error('❌ Erro na conexão de voz:', err);
        });

    } catch (err) {
        console.error('❌ Erro ao entrar no canal de voz:', err);
    }
}

// ============================================================================
// 2. INICIAR ÁUDIO AUTOMATICO (OGG OU MP3)
// ============================================================================

function iniciarAudioAutomatico() {
    const oggPath = path.join(__dirname, '..', '..', 'audio', 'JordanShop.ogg');
    const mp3Path = path.join(__dirname, '..', '..', 'audio', 'JordanShop.mp3');

    if (fs.existsSync(oggPath)) {
        currentAudioPath = oggPath;
        currentFormat = 'ogg';
        tocarAudioLoopInfinito(oggPath, 'ogg');
    } else if (fs.existsSync(mp3Path)) {
        currentAudioPath = mp3Path;
        currentFormat = 'mp3';
        tocarAudioLoopInfinito(mp3Path, 'mp3');
    } else {
        console.error('❌ Nenhum ficheiro de áudio encontrado na pasta /audio/');
    }
}

// ============================================================================
// 3. ÁUDIO EM LOOP INFINITO
// ============================================================================

async function tocarAudioLoopInfinito(audioPath, format = 'ogg') {
    try {
        if (!fs.existsSync(audioPath)) {
            console.error(`❌ Ficheiro não encontrado: ${audioPath}`);
            return false;
        }

        if (isPlaying) return true;

        isPlaying = true;

        if (!audioPlayer) {
            audioPlayer = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play
                }
            });

            audioPlayer.on(AudioPlayerStatus.Idle, () => {
                if (currentAudioPath) {
                    tocarAudioLoopInfinito(currentAudioPath, currentFormat);
                }
            });

            audioPlayer.on(AudioPlayerStatus.Playing, () => {
                console.log("🎵 A tocar:", path.basename(audioPath));
            });

            audioPlayer.on(AudioPlayerStatus.Buffering, () => {
                // Silencioso
            });

            audioPlayer.on('error', (err) => {
                console.error("❌ Erro no player:", err.message);
                isPlaying = false;
                setTimeout(() => {
                    if (currentAudioPath) {
                        tocarAudioLoopInfinito(currentAudioPath, currentFormat);
                    }
                }, 5000);
            });
        }

        if (format === 'ogg') {
            const stream = createReadStream(audioPath);
            currentResource = createAudioResource(stream, {
                inputType: StreamType.OggOpus
            });
        } else {
            currentResource = createAudioResource(audioPath, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });
        }

        if (currentResource.volume) {
            currentResource.volume.setVolume(currentVolume);
        }

        audioPlayer.play(currentResource);

        if (voiceConnection) {
            voiceConnection.subscribe(audioPlayer);
        }

        return true;

    } catch (err) {
        console.error("❌ Erro ao tocar áudio:", err);
        isPlaying = false;
        setTimeout(() => {
            if (currentAudioPath) {
                tocarAudioLoopInfinito(currentAudioPath, currentFormat);
            }
        }, 10000);
        return false;
    }
}

// ============================================================================
// 4. CONTROLO DO ÁUDIO (STOP, VOLUME, ETC)
// ============================================================================

function pararAudio() {
    if (audioPlayer) {
        audioPlayer.stop();
        isPlaying = false;
        console.log("🛑 Áudio parado");
        return true;
    }
    return false;
}

function ajustarVolume(nivel) {
    currentVolume = Math.max(0, Math.min(100, nivel)) / 100;

    if (currentResource && currentResource.volume) {
        currentResource.volume.setVolume(currentVolume);
        console.log(`🔊 Volume ajustado para ${Math.round(currentVolume * 100)}%`);
        return true;
    }
    return false;
}

// ============================================================================
// 5. COMANDOS SLASH (/entrar, /sair, /reiniciar, /audio)
// ============================================================================

async function registrarComandosVoz(client) {
    try {
        const guild = await client.guilds.fetch("1393629457599828040");

        // Comando /entrar
        const comandoEntrar = new SlashCommandBuilder()
            .setName('entrar')
            .setDescription('🔊 Entrar no canal de voz e tocar música');

        // Comando /sair
        const comandoSair = new SlashCommandBuilder()
            .setName('sair')
            .setDescription('🔇 Sair do canal de voz');

        // Comando /reiniciar
        const comandoReiniciar = new SlashCommandBuilder()
            .setName('reiniciar')
            .setDescription('🔄 Reiniciar a música no canal de voz');

        // Comando /audio
        const comandoAudio = new SlashCommandBuilder()
            .setName('audio')
            .setDescription('🎵 Controlar música no canal de voz')
            .addSubcommand(sub =>
                sub.setName('play')
                   .setDescription('Tocar música')
            )
            .addSubcommand(sub =>
                sub.setName('stop')
                   .setDescription('Parar música')
            )
            .addSubcommand(sub =>
                sub.setName('volume')
                   .setDescription('Ajustar volume')
                   .addIntegerOption(opt =>
                       opt.setName('nivel')
                          .setDescription('Volume 0-100')
                          .setRequired(true)
                          .setMinValue(0)
                          .setMaxValue(100)
                   )
            );

        await guild.commands.create(comandoEntrar);
        await guild.commands.create(comandoSair);
        await guild.commands.create(comandoReiniciar);
        await guild.commands.create(comandoAudio);

        console.log('✅ Comandos de voz registados: /entrar, /sair, /reiniciar, /audio');

    } catch (err) {
        console.error('❌ Erro ao registar comandos de voz:', err);
    }
}

async function handleComandoVoz(interaction) {
    if (!interaction.isChatInputCommand()) return false;

    const { commandName, guild, member } = interaction;

    // Comando /entrar
    if (commandName === 'entrar') {
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ 
                content: '❌ Precisas de estar num canal de voz primeiro!', 
                flags: MessageFlags.Ephemeral 
            });
            return true;
        }

        try {
            // Verificar se já está num canal
            const existingConnection = getVoiceConnection(guild.id);
            if (existingConnection) {
                await interaction.reply({ 
                    content: 'ℹ️ Bot já está num canal de voz. Usa `/reiniciar` para reiniciar o áudio.', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }

            voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            voiceConnection.on(VoiceConnectionStatus.Ready, () => {
                console.log('✅ Bot entrou no canal de voz:', voiceChannel.name);
                iniciarAudioAutomatico();
            });

            voiceConnection.on('error', (err) => {
                console.error('❌ Erro na conexão de voz:', err);
            });

            await interaction.reply({ 
                content: `🔊 A entrar no canal **${voiceChannel.name}**...`, 
                flags: MessageFlags.Ephemeral 
            });

        } catch (err) {
            console.error('❌ Erro ao entrar:', err);
            await interaction.reply({ 
                content: '❌ Erro ao entrar no canal de voz.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        return true;
    }

    // Comando /sair
    if (commandName === 'sair') {
        try {
            const connection = getVoiceConnection(guild.id);

            if (!connection) {
                await interaction.reply({ 
                    content: '❌ Bot não está em nenhum canal de voz.', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }

            // Parar áudio primeiro
            pararAudio();

            // Destruir conexão
            connection.destroy();
            voiceConnection = null;

            await interaction.reply({ 
                content: '🔇 Bot saiu do canal de voz.', 
                flags: MessageFlags.Ephemeral 
            });

        } catch (err) {
            console.error('❌ Erro ao sair:', err);
            await interaction.reply({ 
                content: '❌ Erro ao sair do canal de voz.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        return true;
    }

    // Comando /reiniciar
    if (commandName === 'reiniciar') {
        try {
            const connection = getVoiceConnection(guild.id);

            if (!connection) {
                await interaction.reply({ 
                    content: '❌ Bot não está em nenhum canal de voz. Usa `/entrar` primeiro.', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }

            // Parar áudio atual
            pararAudio();

            // Pequeno delay para garantir que para
            await new Promise(resolve => setTimeout(resolve, 500));

            // Reiniciar
            isPlaying = false;
            if (currentAudioPath) {
                tocarAudioLoopInfinito(currentAudioPath, currentFormat);
            } else {
                iniciarAudioAutomatico();
            }

            await interaction.reply({ 
                content: '🔄 Áudio reiniciado!', 
                flags: MessageFlags.Ephemeral 
            });

        } catch (err) {
            console.error('❌ Erro ao reiniciar:', err);
            await interaction.reply({ 
                content: '❌ Erro ao reiniciar o áudio.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        return true;
    }

    // Comando /audio
    if (commandName === 'audio') {
        return await handleAudioCommand(interaction);
    }

    return false;
}

async function handleAudioCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const oggPath = path.join(__dirname, '..', '..', 'audio', 'JordanShop.ogg');
    const mp3Path = path.join(__dirname, '..', '..', 'audio', 'JordanShop.mp3');

    let audioPath, format;
    if (fs.existsSync(oggPath)) {
        audioPath = oggPath;
        format = 'ogg';
    } else {
        audioPath = mp3Path;
        format = 'mp3';
    }

    switch (subcommand) {
        case 'play':
            isPlaying = false;
            const sucesso = await tocarAudioLoopInfinito(audioPath, format);
            if (sucesso) {
                await interaction.reply({ content: '🎵 Música em loop infinito!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ Erro ao tocar ficheiro. Verifica se o ficheiro existe na pasta /audio/', flags: MessageFlags.Ephemeral });
            }
            break;

        case 'stop':
            if (pararAudio()) {
                await interaction.reply({ content: '🛑 Áudio parado', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ Nenhum áudio a tocar', flags: MessageFlags.Ephemeral });
            }
            break;

        case 'volume':
            const nivel = interaction.options.getInteger('nivel');
            if (ajustarVolume(nivel)) {
                await interaction.reply({ content: `🔊 Volume ajustado para ${nivel}%`, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ Não foi possível ajustar volume', flags: MessageFlags.Ephemeral });
            }
            break;
    }

    return true;
}

// ============================================================================
// 6. EMBED DE SUPORTE (3 IDIOMAS) - SÓ ENVIA UMA VEZ
// ============================================================================

const embedsEnviados = new Set();

async function enviarEmbedSuporte(client) {
    try {
        if (embedsEnviados.has(CANAL_TICKET_ID)) {
            console.log('ℹ️ Embed de suporte já enviado anteriormente');
            return;
        }

        const canal = await client.channels.fetch(CANAL_TICKET_ID);
        if (!canal) return console.log('❌ Canal de suporte não encontrado');

        const mensagens = await canal.messages.fetch({ limit: 10 });
        const jaExiste = mensagens.some(m => 
            m.author.id === client.user.id && 
            m.components.length > 0
        );

        if (jaExiste) {
            console.log('ℹ️ Embed de suporte já existe no canal');
            embedsEnviados.add(CANAL_TICKET_ID);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Suporte - Jordan Shop')
            .setDescription(
                `**Para criar um ticket escolhe a opção:**\n` +
                `${EMOJIS.pt} **Suporte**\n\n` +
                `**Para abrir tu ticket elije tu opción:**\n` +
                `${EMOJIS.es} **Suporte**\n\n` +
                `**To create your ticket select:**\n` +
                `${EMOJIS.en} **Support option**`
            )
            .setColor('#8b0000')
            .setFooter({ text: 'Jordan Shop | Sistema de Suporte' });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('menu_suporte_idioma')
            .setPlaceholder('🌐 Seleciona o teu idioma / Selecciona tu idioma / Select your language')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Português')
                    .setDescription('Suporte em Português')
                    .setValue('pt')
                    .setEmoji('1492525538416267536'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Español')
                    .setDescription('Soporte en Español')
                    .setValue('es')
                    .setEmoji('1492525567889641583'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('English')
                    .setDescription('Support in English')
                    .setValue('en')
                    .setEmoji('1492526158309359726')
            );

        const row = new ActionRowBuilder().addComponents(menu);

        await canal.send({ embeds: [embed], components: [row] });
        embedsEnviados.add(CANAL_TICKET_ID);
        console.log('✅ Embed de suporte enviado (primeira vez)');

    } catch (err) {
        console.error('❌ Erro ao enviar embed:', err);
    }
}

// ============================================================================
// 7. FORMULÁRIOS - SÓ ENVIA UMA VEZ
// ============================================================================

async function enviarFormularios(client) {
    try {
        if (embedsEnviados.has(CANAL_FORMULARIO_ID)) {
            console.log('ℹ️ Formulários já enviados anteriormente');
            return;
        }

        const canal = await client.channels.fetch(CANAL_FORMULARIO_ID);
        if (!canal) return console.log('❌ Canal de formulários não encontrado');

        const mensagens = await canal.messages.fetch({ limit: 10 });
        const jaExiste = mensagens.some(m => 
            m.author.id === client.user.id && 
            m.components.length > 0
        );

        if (jaExiste) {
            console.log('ℹ️ Formulários já existem no canal');
            embedsEnviados.add(CANAL_FORMULARIO_ID);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Centro de Feedback - Jordan Shop')
            .setDescription(
                'Bem-vindo ao centro de feedback! Escolhe uma opção abaixo:\n\n' +
                `🐛 **Reportar Bug** - Encontras-te algum problema?\n` +
                `💡 **Ideias** - Tens sugestões para melhorar?\n` +
                `⭐ **Avaliar Bot** - Dá-nos a tua opinião (1-5 estrelas)`
            )
            .setColor('#8b0000')
            .setFooter({ text: 'A tua opinião é importante!' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('form_bug')
                .setLabel('🐛 Reportar Bug')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('form_ideia')
                .setLabel('💡 Ideias')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('form_avaliar')
                .setLabel('⭐ Avaliar Bot')
                .setStyle(ButtonStyle.Success)
        );

        await canal.send({ embeds: [embed], components: [row] });
        embedsEnviados.add(CANAL_FORMULARIO_ID);
        console.log('✅ Formulários enviados (primeira vez)');

    } catch (err) {
        console.error('❌ Erro ao enviar formulários:', err);
    }
}

// ============================================================================
// 8. CRIAR TICKET (CORRIGIDO - COM DEFER E ANTI-DUPLICADO)
// ============================================================================

const ticketsEmCriacao = new Map();

async function criarTicket(interaction, tipo, idioma) {
    const { guild, user, member } = interaction;

    if (ticketsEmCriacao.has(user.id)) {
        return interaction.reply({
            content: '⏳ Já estás a criar um ticket. Aguarda um momento...',
            flags: MessageFlags.Ephemeral
        });
    }

    ticketsEmCriacao.set(user.id, true);

    const nomes = {
        pt: { suporte: 'suporte', compra: 'compra', tecnico: 'tecnico' },
        es: { suporte: 'soporte', compra: 'compra', tecnico: 'tecnico' },
        en: { suporte: 'support', compra: 'purchase', tecnico: 'technical' }
    };

    const prefixo = nomes[idioma][tipo];
    const nomeCanal = `ticket-${prefixo}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketExistente = guild.channels.cache.find(ch => 
            ch.name.includes(`ticket-${prefixo}-${user.username.toLowerCase()}`) &&
            ch.parentId === CATEGORIA_TICKETS_ID
        );

        if (ticketExistente) {
            ticketsEmCriacao.delete(user.id);
            return interaction.editReply({
                content: `❌ Já tens um ticket aberto: ${ticketExistente}`
            });
        }

        const ticketChannel = await guild.channels.create({
            name: nomeCanal,
            type: ChannelType.GuildText,
            parent: CATEGORIA_TICKETS_ID,
            topic: `${user.id}|${tipo}|${idioma}`,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ]
        });

        const textos = {
            pt: {
                titulo: '🎫 Ticket de Suporte',
                desc: `Olá <@${user.id}>!\n\nObrigado por contactares o suporte. A equipa da Jordan Shop irá ajudar-te brevemente.\n\n**Tipo:** Suporte ${tipo}`,
                fechar: '🔒 Fechar Ticket'
            },
            es: {
                titulo: '🎫 Ticket de Soporte',
                desc: `¡Hola <@${user.id}>!\n\nGracias por contactar con el soporte. El equipo de Jordan Shop te ayudará pronto.\n\n**Tipo:** Soporte ${tipo}`,
                fechar: '🔒 Cerrar Ticket'
            },
            en: {
                titulo: '🎫 Support Ticket',
                desc: `Hello <@${user.id}>!\n\nThank you for contacting support. The Jordan Shop team will help you shortly.\n\n**Type:** ${tipo} Support`,
                fechar: '🔒 Close Ticket'
            }
        };

        const t = textos[idioma];

        const embed = new EmbedBuilder()
            .setTitle(t.titulo)
            .setDescription(t.desc)
            .setColor('#8b0000');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fechar_ticket')
                .setLabel(t.fechar)
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });

        await interaction.editReply({
            content: `✅ Ticket criado: ${ticketChannel}`
        });

    } catch (err) {
        console.error('❌ Erro ao criar ticket:', err);

        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ Erro ao criar ticket. Contacta um administrador.'
            });
        } else {
            await interaction.reply({
                content: '❌ Erro ao criar ticket. Contacta um administrador.',
                flags: MessageFlags.Ephemeral
            });
        }
    } finally {
        ticketsEmCriacao.delete(user.id);
    }
}

// ============================================================================
// 9. HANDLERS DE INTERAÇÃO
// ============================================================================

async function handleMenuSuporte(interaction) {
    const idioma = interaction.values[0];

    const textos = {
        pt: { titulo: '🎫 Criar Ticket', desc: 'Escolhe o tipo de suporte:', suporte: 'Suporte Geral', compra: 'Ajuda com Compra', tecnico: 'Problema Técnico' },
        es: { titulo: '🎫 Crear Ticket', desc: 'Elige el tipo de soporte:', suporte: 'Soporte General', compra: 'Ayuda con Compra', tecnico: 'Problema Técnico' },
        en: { titulo: '🎫 Create Ticket', desc: 'Choose support type:', suporte: 'General Support', compra: 'Purchase Help', tecnico: 'Technical Issue' }
    };

    const t = textos[idioma];

    const embed = new EmbedBuilder()
        .setTitle(t.titulo)
        .setDescription(t.desc)
        .setColor('#8b0000');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_suporte_${idioma}`).setLabel(t.suporte).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_compra_${idioma}`).setLabel(t.compra).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_tecnico_${idioma}`).setLabel(t.tecnico).setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

async function handleFormBug(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const modal = new ModalBuilder()
        .setCustomId('modal_bug')
        .setTitle('🐛 Reportar Bug');

    const input1 = new TextInputBuilder()
        .setCustomId('descricao_bug')
        .setLabel('Descrição do Bug')
        .setPlaceholder('Descreve o bug detalhadamente...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

    const input2 = new TextInputBuilder()
        .setCustomId('canal_bug')
        .setLabel('Canal onde ocorreu (opcional)')
        .setPlaceholder('Ex: geral ou #geral ou ID do canal')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input1),
        new ActionRowBuilder().addComponents(input2)
    );

    await interaction.followUp({ content: 'Abre o modal acima!', flags: MessageFlags.Ephemeral });
    await interaction.showModal(modal);
}

async function handleFormIdeia(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const modal = new ModalBuilder()
        .setCustomId('modal_ideia')
        .setTitle('💡 Sugestão');

    const input = new TextInputBuilder()
        .setCustomId('descricao_ideia')
        .setLabel('A tua ideia')
        .setPlaceholder('Descreve a tua sugestão...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.followUp({ content: 'Abre o modal acima!', flags: MessageFlags.Ephemeral });
    await interaction.showModal(modal);
}

async function handleFormAvaliar(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
        .setTitle('⭐ Avalia o Jordan Shop Bot')
        .setDescription('Quantas estrelas dás ao nosso serviço (bot)?')
        .setColor('#FFD700');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('avaliar_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('avaliar_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('avaliar_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('avaliar_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('avaliar_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleAvaliacaoEstrelas(interaction, estrelas) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const modal = new ModalBuilder()
        .setCustomId(`modal_avaliacao_${estrelas}`)
        .setTitle(`⭐ Avaliação: ${estrelas} Estrelas`);

    const input = new TextInputBuilder()
        .setCustomId('motivo_avaliacao')
        .setLabel('Comentário (opcional)')
        .setPlaceholder('Conta-nos o que gostaste ou como podemos melhorar...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.followUp({ content: 'Abre o modal acima!', flags: MessageFlags.Ephemeral });
    await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
    const { customId, fields, user } = interaction;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const LOG_ID = process.env.LOG_CHANNEL_ID || "1495145643977478154";
    const logChannel = await interaction.guild.channels.fetch(LOG_ID).catch(() => null);

    if (customId === 'modal_bug') {
        const descricao = fields.getTextInputValue('descricao_bug');
        const canal = fields.getTextInputValue('canal_bug') || 'Não especificado';

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🐛 Novo Bug Reportado')
                .addFields(
                    { name: 'Utilizador', value: `<@${user.id}>`, inline: true },
                    { name: 'Canal', value: canal, inline: true },
                    { name: 'Descrição', value: descricao }
                )
                .setColor('#FF0000')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({ content: '✅ Bug reportado com sucesso! Obrigado.' });
    }
    else if (customId === 'modal_ideia') {
        const ideia = fields.getTextInputValue('descricao_ideia');

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('💡 Nova Sugestão')
                .addFields(
                    { name: 'Utilizador', value: `<@${user.id}>`, inline: true },
                    { name: 'Ideia', value: ideia }
                )
                .setColor('#5865F2')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({ content: '💡 Obrigado pela tua sugestão!' });
    }
    else if (customId.startsWith('modal_avaliacao_')) {
        const estrelas = customId.split('_')[2];
        const motivo = fields.getTextInputValue('motivo_avaliacao') || 'Sem comentário';

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('⭐ Nova Avaliação')
                .addFields(
                    { name: 'Utilizador', value: `<@${user.id}>`, inline: true },
                    { name: 'Avaliação', value: '⭐'.repeat(parseInt(estrelas)), inline: true },
                    { name: 'Comentário', value: motivo }
                )
                .setColor('#FFD700')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({ content: `⭐ Obrigado pela tua avaliação de ${estrelas} estrelas!` });
    }
}

// ============================================================================
// 10. HANDLER PRINCIPAL
// ============================================================================

async function handleSistemaInteraction(interaction, client) {
    // Comandos de voz (/entrar, /sair, /reiniciar, /audio)
    if (interaction.isChatInputCommand()) {
        const vozCommands = ['entrar', 'sair', 'reiniciar', 'audio'];
        if (vozCommands.includes(interaction.commandName)) {
            await handleComandoVoz(interaction);
            return true;
        }
    }

    // Menu de idioma
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_suporte_idioma') {
        await handleMenuSuporte(interaction);
        return true;
    }

    // Botões de ticket
    if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
        const parts = interaction.customId.split('_');
        const tipo = parts[1];
        const idioma = parts[2];

        await criarTicket(interaction, tipo, idioma);
        return true;
    }

    // Botão fechar ticket
    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        const { channel } = interaction;
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: '❌ Este não é um canal de ticket.', flags: MessageFlags.Ephemeral });
        }
        await interaction.reply({ content: '🔒 A fechar ticket em 5 segundos...', flags: MessageFlags.Ephemeral });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return true;
    }

    // Botões de formulário
    if (interaction.isButton()) {
        if (interaction.customId === 'form_bug') {
            await handleFormBug(interaction);
            return true;
        }
        if (interaction.customId === 'form_ideia') {
            await handleFormIdeia(interaction);
            return true;
        }
        if (interaction.customId === 'form_avaliar') {
            await handleFormAvaliar(interaction);
            return true;
        }
        if (interaction.customId.startsWith('avaliar_')) {
            const estrelas = interaction.customId.split('_')[1];
            await handleAvaliacaoEstrelas(interaction, estrelas);
            return true;
        }
    }

    // Modais
    if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return true;
    }

    return false;
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
    entrarCanalVoz,
    enviarEmbedSuporte,
    enviarFormularios,
    handleSistemaInteraction,
    registrarComandosVoz,
    handleAudioCommand,
};
