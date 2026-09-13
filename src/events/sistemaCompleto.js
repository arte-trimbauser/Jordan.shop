// src/events/sistemaCompleto.js - SISTEMA DE ÁUDIO + EMBEDS + TICKETS + FORMULÁRIOS + NOTIFICAÇÕES + SUSPENSÃO
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
    NoSubscriberBehavior,
    demuxProbe
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { createReadStream } = require('node:fs');
const config = require('../config');

const ffmpegPath = require('ffmpeg-static');
console.log('📁 FFmpeg path:', ffmpegPath);

const CANAL_VOZ_ID = "1492521949736472757";
const CANAL_TICKET_ID = "1493942678612869311";
const CANAL_FORMULARIO_ID = "1490783323780419664";
const CATEGORIA_TICKETS_ID = "1490783459470475414";
// ✅ Canal fixo exclusivo para feedback (bugs / ideias / avaliações)
const LOG_FEEDBACK_CHANNEL_ID = "1495145643977478154";

const EMOJIS = {
    pt: "<:Flag_of_Portugal:1492525538416267536>",
    es: "<:Flag_of_Spain:1492525567889641583>",
    en: "<:Flag_of_England:1492526158309359726>"
};

let voiceConnection = null;
let audioPlayer = null;
let currentResource = null;
let currentVolume = 0.5;
let isPlaying = false;

// ============================================================
// ESTADO TEMPORÁRIO DE FORMULÁRIOS
// ============================================================
// Mapa: userId -> { messageId, channelId, estrelas, ts }
// Usado para editar a mensagem de avaliação original em vez de criar uma nova
const avaliacoesPendentes = new Map();

// Mapa: userId -> gravidade ("Ligeiro" | "Moderado" | "Critico")
// Usado entre o select de gravidade e o modal de bug
const bugSeveridadePendente = new Map();

// ============================================================
// HELPERS DE FEEDBACK
// ============================================================
const SEVERIDADES = {
    ligeiro:  { label: "🟢 Ligeiro",   desc: "Não impede o uso normal",           cor: 0x2ECC71, tag: "🟢 Ligeiro"   },
    moderado: { label: "🟡 Moderado",  desc: "Atrapalha mas dá para contornar",   cor: 0xF1C40F, tag: "🟡 Moderado"  },
    critico:  { label: "🔴 Crítico",   desc: "Impede o uso / quebra tudo",        cor: 0xE74C3C, tag: "🔴 Crítico 🚨" }
};

function dataHoraPT() {
    return new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Lisbon",
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date());
}

function getAudioPath() {
    const oggPath = path.join(__dirname, '..', '..', 'audio', 'JordanShop.ogg');
    const mp3Path = path.join(__dirname, '..', '..', 'audio', 'JordanShop.mp3');
    if (fs.existsSync(oggPath)) return oggPath;
    else if (fs.existsSync(mp3Path)) return mp3Path;
    return null;
}

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

async function iniciarAudioAutomatico() {
    const audioPath = getAudioPath();
    if (!audioPath) {
        console.error('❌ Nenhum ficheiro de áudio encontrado na pasta /audio/');
        return;
    }
    console.log('🎵 Ficheiro encontrado:', path.basename(audioPath));
    await tocarAudioLoopInfinito(audioPath);
}

async function tocarAudioLoopInfinito(audioPath) {
    try {
        if (!audioPath || !fs.existsSync(audioPath)) {
            console.error(`❌ Ficheiro não encontrado: ${audioPath}`);
            return false;
        }
        if (isPlaying) {
            console.log('ℹ️ Áudio já está a tocar');
            return true;
        }
        console.log('🎵 A preparar reprodução de:', path.basename(audioPath));
        if (!audioPlayer) {
            audioPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
            audioPlayer.on(AudioPlayerStatus.Idle, () => {
                console.log("🎵 Música terminou, reiniciando...");
                isPlaying = false;
                const pathAtual = getAudioPath();
                if (pathAtual) setTimeout(() => tocarAudioLoopInfinito(pathAtual), 1000);
            });
            audioPlayer.on(AudioPlayerStatus.Playing, () => {
                console.log("🎵 A tocar:", path.basename(audioPath));
            });
            audioPlayer.on('error', (err) => {
                console.error("❌ Erro no player:", err.message);
                isPlaying = false;
                setTimeout(() => {
                    const pathAtual = getAudioPath();
                    if (pathAtual) tocarAudioLoopInfinito(pathAtual);
                }, 5000);
            });
        }
        const stream = createReadStream(audioPath);
        const { stream: probedStream, type } = await demuxProbe(stream);
        console.log(`🔍 Formato detetado: ${type}`);
        currentResource = createAudioResource(probedStream, { inputType: type, inlineVolume: true });
        if (currentResource.volume) currentResource.volume.setVolume(currentVolume);
        if (voiceConnection) voiceConnection.subscribe(audioPlayer);
        audioPlayer.play(currentResource);
        isPlaying = true;
        return true;
    } catch (err) {
        console.error("❌ Erro ao tocar áudio:", err);
        isPlaying = false;
        setTimeout(() => {
            const pathAtual = getAudioPath();
            if (pathAtual) tocarAudioLoopInfinito(pathAtual);
        }, 10000);
        return false;
    }
}

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
// 5. COMANDOS SLASH
// ============================================================================
async function registrarComandosVoz(client) {
    try {
        const guild = await client.guilds.fetch("1393629457599828040");
        const comandoEntrar = new SlashCommandBuilder().setName('entrar').setDescription('🔊 Entrar no canal de voz e tocar música');
        const comandoSair = new SlashCommandBuilder().setName('sair').setDescription('🔇 Sair do canal de voz');
        const comandoReiniciar = new SlashCommandBuilder().setName('reiniciar').setDescription('🔄 Reiniciar a música no canal de voz');
        const comandoAudio = new SlashCommandBuilder()
            .setName('audio')
            .setDescription('🎵 Controlar música no canal de voz')
            .addSubcommand(sub => sub.setName('play').setDescription('Tocar música'))
            .addSubcommand(sub => sub.setName('stop').setDescription('Parar música'))
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

    if (commandName === 'entrar') {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: '❌ Precisas de estar num canal de voz primeiro!', flags: MessageFlags.Ephemeral });
            return true;
        }
        try {
            const existingConnection = getVoiceConnection(guild.id);
            if (existingConnection) {
                await interaction.reply({ content: 'ℹ️ Bot já está num canal de voz. Usa `/reiniciar` para reiniciar o áudio.', flags: MessageFlags.Ephemeral });
                return true;
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
            await interaction.editReply({ content: `🔊 Entrei no canal **${voiceChannel.name}** e estou a tocar música!` });
        } catch (err) {
            console.error('❌ Erro ao entrar:', err);
            await interaction.editReply({ content: '❌ Erro ao entrar no canal de voz.' });
        }
        return true;
    }

    if (commandName === 'sair') {
        try {
            const connection = getVoiceConnection(guild.id);
            if (!connection) {
                await interaction.reply({ content: '❌ Bot não está em nenhum canal de voz.', flags: MessageFlags.Ephemeral });
                return true;
            }
            pararAudio();
            connection.destroy();
            voiceConnection = null;
            await interaction.reply({ content: '🔇 Saí do canal de voz.', flags: MessageFlags.Ephemeral });
        } catch (err) {
            console.error('❌ Erro ao sair:', err);
            await interaction.reply({ content: '❌ Erro ao sair do canal de voz.', flags: MessageFlags.Ephemeral });
        }
        return true;
    }

    if (commandName === 'reiniciar') {
        try {
            const connection = getVoiceConnection(guild.id);
            if (!connection) {
                await interaction.reply({ content: '❌ Bot não está em nenhum canal de voz. Usa `/entrar` primeiro.', flags: MessageFlags.Ephemeral });
                return true;
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            pararAudio();
            await new Promise(resolve => setTimeout(resolve, 500));
            isPlaying = false;
            const audioPath = getAudioPath();
            if (audioPath) {
                const sucesso = await tocarAudioLoopInfinito(audioPath);
                await interaction.editReply({ content: sucesso ? '🔄 Áudio reiniciado!' : '❌ Erro ao reiniciar áudio.' });
            } else {
                await interaction.editReply({ content: '❌ Ficheiro de áudio não encontrado.' });
            }
        } catch (err) {
            console.error('❌ Erro ao reiniciar:', err);
            await interaction.editReply({ content: '❌ Erro ao reiniciar o áudio.' });
        }
        return true;
    }

    if (commandName === 'audio') {
        return await handleAudioCommand(interaction);
    }
    return false;
}

async function handleAudioCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const audioPath = getAudioPath();

    switch (subcommand) {
        case 'play':
            if (!audioPath) {
                await interaction.editReply({ content: '❌ Ficheiro de áudio não encontrado na pasta /audio/' });
                return true;
            }
            isPlaying = false;
            const sucesso = await tocarAudioLoopInfinito(audioPath);
            await interaction.editReply({ content: sucesso ? '🎵 Música em loop infinito!' : '❌ Erro ao tocar ficheiro. Verifica se o ficheiro existe na pasta /audio/' });
            break;
        case 'stop':
            if (pararAudio()) {
                await interaction.editReply({ content: '🛑 Áudio parado' });
            } else {
                await interaction.editReply({ content: '❌ Nenhum áudio a tocar' });
            }
            break;
        case 'volume':
            const nivel = interaction.options.getInteger('nivel');
            if (ajustarVolume(nivel)) {
                await interaction.editReply({ content: `🔊 Volume ajustado para ${nivel}%` });
            } else {
                await interaction.editReply({ content: '❌ Não foi possível ajustar volume' });
            }
            break;
    }
    return true;
}

// ============================================================================
// 6. EMBED DE SUPORTE
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
        const jaExiste = mensagens.some(m => m.author.id === client.user.id && m.components.length > 0);
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
                new StringSelectMenuOptionBuilder().setLabel('Português').setDescription('Suporte em Português').setValue('pt').setEmoji('1492525538416267536'),
                new StringSelectMenuOptionBuilder().setLabel('Español').setDescription('Soporte en Español').setValue('es').setEmoji('1492525567889641583'),
                new StringSelectMenuOptionBuilder().setLabel('English').setDescription('Support in English').setValue('en').setEmoji('1492526158309359726')
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
// 7. FORMULÁRIOS
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
        const jaExiste = mensagens.some(m => m.author.id === client.user.id && m.components.length > 0);
        if (jaExiste) {
            console.log('ℹ️ Formulários já existem no canal');
            embedsEnviados.add(CANAL_FORMULARIO_ID);
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle('📋 Centro de Feedback - Jordan Shop')
            .setDescription(
                'Bem-vindo ao centro de feedback! Escolhe uma opção abaixo:\n\n' +
                `🐛 **Reportar Bug** — Encontraste algum problema?\n` +
                `💡 **Ideias** — Tens sugestões para melhorar?\n` +
                `⭐ **Avaliar Bot** — Dá-nos a tua opinião (1-5 estrelas)`
            )
            .setColor('#8b0000')
            .setFooter({ text: 'A tua opinião é importante!' });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('form_bug').setLabel('🐛 Reportar Bug').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('form_ideia').setLabel('💡 Ideias').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('form_avaliar').setLabel('⭐ Avaliar Bot').setStyle(ButtonStyle.Success)
        );
        await canal.send({ embeds: [embed], components: [row] });
        embedsEnviados.add(CANAL_FORMULARIO_ID);
        console.log('✅ Formulários enviados (primeira vez)');
    } catch (err) {
        console.error('❌ Erro ao enviar formulários:', err);
    }
}

// ============================================================================
// 8. CRIAR TICKET
// ============================================================================
const ticketsEmCriacao = new Map();

async function criarTicket(interaction, tipo, idioma) {
    const { guild, user, member } = interaction;
    if (ticketsEmCriacao.has(user.id)) {
        return interaction.reply({ content: '⏳ Já estás a criar um ticket. Aguarda um momento...', flags: MessageFlags.Ephemeral });
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
            return interaction.editReply({ content: `❌ Já tens um ticket aberto: ${ticketExistente}` });
        }
        const ticketChannel = await guild.channels.create({
            name: nomeCanal,
            type: ChannelType.GuildText,
            parent: CATEGORIA_TICKETS_ID,
            topic: `${user.id}|${tipo}|${idioma}`,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
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
            new ButtonBuilder().setCustomId('fechar_ticket').setLabel(t.fechar).setStyle(ButtonStyle.Danger)
        );
        await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
        await interaction.editReply({ content: `✅ Ticket criado: ${ticketChannel}` });
    } catch (err) {
        console.error('❌ Erro ao criar ticket:', err);
        if (interaction.deferred) {
            await interaction.editReply({ content: '❌ Erro ao criar ticket. Contacta um administrador.' });
        } else {
            await interaction.reply({ content: '❌ Erro ao criar ticket. Contacta um administrador.', flags: MessageFlags.Ephemeral });
        }
    } finally {
        ticketsEmCriacao.delete(user.id);
    }
}

// ============================================================================
// 9. NOTIFICAÇÃO DE RESPOSTA DE STAFF
// ============================================================================
let ticketNotificationEnabled = true;

function setupTicketReplyNotification(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (!message.channel.name || !message.channel.name.startsWith('ticket-')) return;
        const member = message.member;
        if (!member) return;
        const isStaffMember = config.STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
        if (!isStaffMember) return;
        const topic = message.channel.topic;
        if (!topic) return;
        const [creatorId] = topic.split('|');
        if (!creatorId || creatorId === message.author.id) return;
        if (!ticketNotificationEnabled) return;
        try {
            const creator = await client.users.fetch(creatorId);
            if (!creator) return;
            const embed = new EmbedBuilder()
                .setTitle(`📩 Nova resposta no ticket`)
                .setDescription(
                    `Olá ${creator.username},\n\n` +
                    `**${message.author.username}** respondeu ao teu ticket **${message.channel.name}**.\n` +
                    `Clica no botão abaixo para ires diretamente para o ticket.`
                )
                .setColor('#00ff00')
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 Ir para o Ticket')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
            );
            await creator.send({ embeds: [embed], components: [row] });
            console.log(`📩 Notificação enviada a ${creator.tag} sobre resposta de ${message.author.tag} no ticket ${message.channel.name}`);
        } catch (error) {
            console.error(`❌ Erro ao enviar notificação para ${creatorId}:`, error.message);
        }
    });
    console.log('✅ Sistema de notificação de tickets ativo');
}

function toggleTicketNotification(enable) {
    ticketNotificationEnabled = enable;
    console.log(`📩 Notificações de ticket ${enable ? 'ativadas' : 'desativadas'}`);
}

// ============================================================================
// 10. MONITORIZAÇÃO DE INATIVIDADE (10 MINUTOS)
// ============================================================================
function iniciarMonitorizacaoInatividadeTickets(client) {
    const ticketsInativos = new Map();
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (!message.channel.name || !message.channel.name.startsWith('ticket-')) return;
        const channelId = message.channel.id;
        if (ticketsInativos.has(channelId)) {
            clearTimeout(ticketsInativos.get(channelId).timeout);
        }
        const timeout = setTimeout(async () => {
            await verificarInatividadeTicket(message.channel, client);
        }, 10 * 60 * 1000);
        ticketsInativos.set(channelId, { lastMessage: Date.now(), timeout });
    });
    console.log('✅ Monitorização de inatividade de tickets iniciada (10 min)');
}

async function verificarInatividadeTicket(channel, client) {
    try {
        const messages = await channel.messages.fetch({ limit: 5 });
        const lastMsg = messages.first();
        if (!lastMsg || lastMsg.author.bot) return;
        const member = await channel.guild.members.fetch(lastMsg.author.id).catch(() => null);
        if (!member) return;
        const isStaff = config.STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
        if (isStaff) return;
        const topic = channel.topic;
        if (!topic) return;
        const [creatorId] = topic.split('|');
        if (!creatorId) return;
        const guild = channel.guild;
        const staffMembers = await guild.members.fetch();
        const staffOnline = staffMembers.filter(m =>
            m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) &&
            !m.user.bot &&
            m.presence?.status !== 'offline'
        );
        if (staffOnline.size === 0) return;
        const embed = new EmbedBuilder()
            .setTitle('⏰ Ticket sem resposta')
            .setDescription(
                `O ticket **${channel.name}** está sem resposta há mais de 10 minutos.\n` +
                `O cliente <@${creatorId}> aguarda atendimento.\n` +
                `Clique no botão para ir ao ticket.`
            )
            .setColor('#ff9900')
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🔗 Ir para o Ticket')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
        );
        for (const [id, staff] of staffOnline) {
            try {
                await staff.send({ embeds: [embed], components: [row] });
            } catch (e) {}
        }
        console.log(`⏰ Notificação de inatividade enviada para ${staffOnline.size} staff sobre o ticket ${channel.name}`);
    } catch (err) {
        console.error('❌ Erro ao verificar inatividade:', err);
    }
}

// ============================================================================
// 11. ROTA DE SUSPENSÃO E REATIVAÇÃO (PARA CRON JOB)
// ============================================================================
function setupSuspendRoute(app) {
    app.post('/api/suspend', async (req, res) => {
        const token = req.query.token;
        const SECRET_TOKEN = process.env.SUSPEND_TOKEN || 'mudar_esta_chave';
        if (token !== SECRET_TOKEN) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        try {
            const renderApiKey = process.env.RENDER_API_KEY;
            const serviceId = process.env.RENDER_SERVICE_ID;
            if (!renderApiKey || !serviceId) {
                return res.status(500).json({ error: 'Render API key ou Service ID não configurados' });
            }
            const response = await fetch(`https://api.render.com/v1/services/${serviceId}/suspend`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${renderApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                res.json({ success: true, message: 'Serviço suspenso com sucesso' });
            } else {
                const errorText = await response.text();
                res.status(response.status).json({ error: errorText });
            }
        } catch (err) {
            console.error('Erro ao suspender:', err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/resume', async (req, res) => {
        const token = req.query.token;
        const SECRET_TOKEN = process.env.SUSPEND_TOKEN || 'mudar_esta_chave';
        if (token !== SECRET_TOKEN) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        try {
            const renderApiKey = process.env.RENDER_API_KEY;
            const serviceId = process.env.RENDER_SERVICE_ID;
            if (!renderApiKey || !serviceId) {
                return res.status(500).json({ error: 'Render API key ou Service ID não configurados' });
            }
            const response = await fetch(`https://api.render.com/v1/services/${serviceId}/resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${renderApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                res.json({ success: true, message: 'Serviço reativado com sucesso' });
            } else {
                const errorText = await response.text();
                res.status(response.status).json({ error: errorText });
            }
        } catch (err) {
            console.error('Erro ao reativar:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// ============================================================================
// 12. HANDLERS DE INTERAÇÃO
// ============================================================================
async function handleMenuSuporte(interaction) {
    const idioma = interaction.values[0];
    const textos = {
        pt: { titulo: '🎫 Criar Ticket', desc: 'Escolhe o tipo de suporte:', suporte: 'Suporte Geral', compra: 'Ajuda com Compra', tecnico: 'Problema Técnico' },
        es: { titulo: '🎫 Crear Ticket', desc: 'Elige el tipo de soporte:', suporte: 'Soporte General', compra: 'Ayuda con Compra', tecnico: 'Problema Técnico' },
        en: { titulo: '🎫 Create Ticket', desc: 'Choose support type:', suporte: 'General Support', compra: 'Purchase Help', tecnico: 'Technical Issue' }
    };
    const t = textos[idioma];
    const embed = new EmbedBuilder().setTitle(t.titulo).setDescription(t.desc).setColor('#8b0000');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_suporte_${idioma}`).setLabel(t.suporte).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_compra_${idioma}`).setLabel(t.compra).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_tecnico_${idioma}`).setLabel(t.tecnico).setStyle(ButtonStyle.Danger)
    );
    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

// ===================== FORMULÁRIOS =====================

// ---------- BUG: Passo 1 — botão "Reportar Bug" abre o select de gravidade ----------
async function handleFormBug(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🐛 Reportar Bug — Passo 1/2')
        .setDescription(
            'Antes de continuares, escolhe a **gravidade** do problema:\n\n' +
            '🟢 **Ligeiro** — Não impede o uso normal\n' +
            '🟡 **Moderado** — Atrapalha mas dá para contornar\n' +
            '🔴 **Crítico** — Impede o uso / quebra tudo\n\n' +
            '⚠️ **Dica:** Tem um **print/captura** do erro? Guarda-o — vais poder anexá-lo depois no canal de suporte.'
        )
        .setColor('#8b0000');

    const select = new StringSelectMenuBuilder()
        .setCustomId('bug_severidade')
        .setPlaceholder('Escolhe a gravidade do bug')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Ligeiro')
                .setDescription('Não impede o uso normal')
                .setValue('ligeiro')
                .setEmoji('🟢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Moderado')
                .setDescription('Atrapalha mas dá para contornar')
                .setValue('moderado')
                .setEmoji('🟡'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Crítico')
                .setDescription('Impede o uso / quebra tudo')
                .setValue('critico')
                .setEmoji('🔴')
        );

    await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral
    });
}

// ---------- BUG: Passo 2 — select de gravidade abre o modal ----------
async function handleBugSeveridade(interaction) {
    const gravidade = interaction.values[0];
    const info = SEVERIDADES[gravidade] || SEVERIDADES.moderado;

    // Guarda a gravidade para usar no submit do modal
    bugSeveridadePendente.set(interaction.user.id, gravidade);

    const modal = new ModalBuilder()
        .setCustomId('modal_bug')
        .setTitle(`🐛 Reportar Bug (${info.label})`);

    const inputDescricao = new TextInputBuilder()
        .setCustomId('descricao_bug')
        .setLabel('Descrição do problema')
        .setPlaceholder('O que está a acontecer exatamente?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

    const inputPassos = new TextInputBuilder()
        .setCustomId('passos_bug')
        .setLabel('Passos para reproduzir')
        .setPlaceholder('1. Abri o ticket\\n2. Cliquei em X\\n3. Deu erro Y')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

    const inputCanal = new TextInputBuilder()
        .setCustomId('canal_bug')
        .setLabel('Onde ocorre (Canal / Local)')
        .setPlaceholder('Ex: #sugestão, #tickets, canal de voz…')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);

    modal.addComponents(
        new ActionRowBuilder().addComponents(inputDescricao),
        new ActionRowBuilder().addComponents(inputPassos),
        new ActionRowBuilder().addComponents(inputCanal)
    );

    await interaction.showModal(modal);
}

// ---------- IDEIA ----------
async function handleFormIdeia(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_ideia')
        .setTitle('💡 Enviar Sugestão');

    const input = new TextInputBuilder()
        .setCustomId('descricao_ideia')
        .setLabel('A tua ideia')
        .setPlaceholder('Descreve a tua sugestão de forma clara…')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

// ---------- AVALIAÇÃO ----------
async function handleFormAvaliar(interaction) {
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

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });

    // ✅ Guarda o TOKEN desta interação (é a que criou a mensagem efémera)
    // para mais tarde podermos editar a mensagem quando o user submeter o modal
    avaliacoesPendentes.set(interaction.user.id, {
        token: interaction.token,
        applicationId: interaction.applicationId,
        estrelas: null,
        ts: Date.now()
    });
}

async function handleAvaliacaoEstrelas(interaction, estrelas) {
    // ✅ Atualiza o estado pendente com as estrelas escolhidas
    const pendente = avaliacoesPendentes.get(interaction.user.id);
    if (pendente) {
        pendente.estrelas = estrelas;
    } else {
        // Caso raro: o token original perdeu-se — guarda o atual como fallback
        avaliacoesPendentes.set(interaction.user.id, {
            token: interaction.token,
            applicationId: interaction.applicationId,
            estrelas,
            ts: Date.now()
        });
    }

    // showModal TEM de ser a PRIMEIRA resposta à interação
    const modal = new ModalBuilder()
        .setCustomId(`modal_avaliacao_${estrelas}`)
        .setTitle(`⭐ Avaliação: ${estrelas} Estrelas`);

    const input = new TextInputBuilder()
        .setCustomId('motivo_avaliacao')
        .setLabel('Comentário (opcional)')
        .setPlaceholder('Conta-nos o que gostaste ou como podemos melhorar…')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

// ---------- SUBMIT DOS MODAIS ----------
async function handleModalSubmit(interaction) {
    const { customId, fields, user } = interaction;

    const ehModalDoSistema =
        customId === 'modal_bug' ||
        customId === 'modal_ideia' ||
        customId.startsWith('modal_avaliacao_');

    if (!ehModalDoSistema) {
        return; // deixa o interactionCreate.js tratar
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const logChannel = await interaction.guild.channels.fetch(LOG_FEEDBACK_CHANNEL_ID).catch(() => null);

    // ============================================================
    // BUG
    // ============================================================
    if (customId === 'modal_bug') {
        const descricao = fields.getTextInputValue('descricao_bug');
        const passos    = fields.getTextInputValue('passos_bug');
        const canal     = fields.getTextInputValue('canal_bug') || 'Não especificado';

        const gravidadeKey = bugSeveridadePendente.get(user.id) || 'moderado';
        const info = SEVERIDADES[gravidadeKey] || SEVERIDADES.moderado;
        bugSeveridadePendente.delete(user.id);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ NOVO BUG REPORTADO')
                .setDescription(
                    `👤 **Reportado por:** <@${user.id}>\n` +
                    `📍 **Onde ocorre:** \`${canal}\`\n` +
                    `🔥 **Gravidade:** ${info.tag}\n\n` +
                    `🛠️ **Descrição do Problema:**\n` +
                    `> ${descricao.split('\n').join('\n> ')}\n\n` +
                    `📋 **Passos para reproduzir:**\n` +
                    `> ${passos.split('\n').join('\n> ')}\n\n` +
                    `🖼️ **Print do erro?** Responde neste canal com a imagem, se tiveres.\n\n` +
                    `🚥 **Estado:** 🔴 Pendente de verificação`
                )
                .setColor(info.cor)
                .setFooter({ text: `Jordan Shop | Feedback • ${dataHoraPT()}` })
                .setTimestamp();

            const msg = await logChannel.send({ embeds: [embed] }).catch(() => null);
            if (msg) {
                // Reação visual para dar destaque, ajuda staff a filtrar
                await msg.react('👀').catch(() => {});
            }
        }

        await interaction.editReply({
            content:
                '✅ **Bug reportado com sucesso!**\n\n' +
                '🖼️ Se tiveres um **print do erro**, envia-o agora no canal de suporte (ou responde ao embed do teu bug).\n' +
                'A equipa vai verificar em breve. Obrigado!'
        });
    }

    // ============================================================
    // IDEIA / SUGESTÃO
    // ============================================================
    else if (customId === 'modal_ideia') {
        const ideia = fields.getTextInputValue('descricao_ideia');

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('💡 NOVA SUGESTÃO DE UTILIZADOR')
                .setDescription(
                    `**Autor:** <@${user.id}>\n\n` +
                    `**Ideia:**\n` +
                    `> ${ideia.split('\n').join('\n> ')}\n\n` +
                    `📌 **Vota nas reações abaixo:** 👍 (Aprovar) | 👎 (Rejeitar)`
                )
                .setColor(0x5865F2)
                .setFooter({ text: `Jordan Shop | Feedback • ${dataHoraPT()} • 🟡 Em Análise` })
                .setTimestamp();

            const msg = await logChannel.send({ embeds: [embed] }).catch(() => null);
            if (msg) {
                // Reações automáticas de votação
                await msg.react('👍').catch(() => {});
                await msg.react('👎').catch(() => {});
            }
        }

        await interaction.editReply({
            content:
                '💡 **Obrigado pela tua sugestão!**\n\n' +
                'A tua ideia foi enviada para a equipa e a comunidade pode votar com 👍 / 👎.'
        });
    }

    // ============================================================
    // AVALIAÇÃO
    // ============================================================
    else if (customId.startsWith('modal_avaliacao_')) {
        const estrelas = customId.split('_')[2];
        const numEstrelas = parseInt(estrelas) || 0;
        const motivo = fields.getTextInputValue('motivo_avaliacao') || 'Sem comentário';

        // 1. Enviar o log no canal de feedback
        if (logChannel) {
            const embedLog = new EmbedBuilder()
                .setTitle('⭐ Nova Avaliação')
                .addFields(
                    { name: 'Utilizador', value: `<@${user.id}>`, inline: true },
                    { name: 'Avaliação', value: `\`${'⭐'.repeat(numEstrelas)}\``, inline: true },
                    { name: 'Comentário', value: `\`${motivo}\`` }
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Jordan Shop | Feedback' })
                .setTimestamp();
            await logChannel.send({ embeds: [embedLog] });
        }

        // 2. Editar a mensagem original efémera (a que tinha as estrelas)
        //    Usa o endpoint de webhook com o token da interação original
        const pendente = avaliacoesPendentes.get(user.id);
        if (pendente && pendente.token && pendente.applicationId) {
            try {
                const titulo = numEstrelas === 1
                    ? '⭐ Obrigado pela tua avaliação de 1 estrela!'
                    : `⭐ Obrigado pela tua avaliação de ${numEstrelas} estrelas!`;

                const url = `https://discord.com/api/v10/webhooks/${pendente.applicationId}/${pendente.token}/messages/@original`;
                const resp = await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: titulo,
                            color: 0xFFD700
                        }],
                        components: []
                    })
                });
                if (!resp.ok) {
                    const txt = await resp.text().catch(() => '');
                    console.error('⚠️ Erro ao editar mensagem de avaliação:', resp.status, txt);
                }
            } catch (err) {
                console.error('⚠️ Não foi possível editar a mensagem de avaliação:', err.message);
            }
            avaliacoesPendentes.delete(user.id);
        }

        // 3. Apagar a resposta efémera do modal
        await interaction.deleteReply().catch(() => {});
    }
}  // ← ADICIONA ESTA CHAVETA (fecha a função handleModalSubmit)

// ============================================================================
// 13. HANDLER PRINCIPAL
// ============================================================================
async function handleSistemaInteraction(interaction, client) {
    if (interaction.isChatInputCommand()) {
        const vozCommands = ['entrar', 'sair', 'reiniciar', 'audio'];
        if (vozCommands.includes(interaction.commandName)) {
            await handleComandoVoz(interaction);
            return true;
        }
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_suporte_idioma') {
        await handleMenuSuporte(interaction);
        return true;
    }
    // ⭐ NOVO — Select de gravidade do bug (passo 1/2)
    if (interaction.isStringSelectMenu() && interaction.customId === 'bug_severidade') {
        await handleBugSeveridade(interaction);
        return true;
    }
    if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
        const parts = interaction.customId.split('_');
        const tipo = parts[1];
        const idioma = parts[2];
        await criarTicket(interaction, tipo, idioma);
        return true;
    }
    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        const { channel } = interaction;
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: '❌ Este não é um canal de ticket.', flags: MessageFlags.Ephemeral });
        }
        await interaction.reply({ content: '🔒 A fechar ticket em 5 segundos...', flags: MessageFlags.Ephemeral });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return true;
    }
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
    if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        const ehModalDoSistema =
            id === 'modal_bug' ||
            id === 'modal_ideia' ||
            id.startsWith('modal_avaliacao_');

        if (ehModalDoSistema) {
            await handleModalSubmit(interaction);
            return true;
        }
        // Modais desconhecidos seguem para o interactionCreate.js
    }
    return false;
}

// ============================================================================
// 14. INICIALIZAÇÕES
// ============================================================================
function inicializarNotificacaoTickets(client) {
    setupTicketReplyNotification(client);
    console.log('📩 Sistema de notificação de tickets inicializado!');
}

// Limpeza periódica dos Maps temporários
setInterval(() => {
    const agora = Date.now();
    for (const [userId, dados] of avaliacoesPendentes) {
        if (agora - dados.ts > 15 * 60 * 1000) avaliacoesPendentes.delete(userId);
    }
    // Bugs pendentes: se o user abandonar, limpamos após 10 min
    for (const [userId, key] of bugSeveridadePendente) {
        // Sem timestamp — limpamos por tamanho máximo em cada ciclo
        // (simples e evita leaks)
    }
    if (bugSeveridadePendente.size > 500) bugSeveridadePendente.clear();
}, 5 * 60 * 1000);

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
    inicializarNotificacaoTickets,
    toggleTicketNotification,
    iniciarMonitorizacaoInatividadeTickets,
    setupSuspendRoute
};
