// src/events/sistemaCompleto.js - VERSÃO COMPLETA COM ÁUDIO
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
    SlashCommandBuilder
} = require('discord.js');
const { 
    joinVoiceChannel, 
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

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

// ============================================================================
// 1. BOT ENTRA NO CANAL DE VOZ E TOCA MP3 EM LOOP INFINITO
// ============================================================================

async function entrarCanalVoz(client) {
    try {
        const guild = client.guilds.cache.first();
        const canal = await guild.channels.fetch(CANAL_VOZ_ID);
        
        if (!canal || canal.type !== ChannelType.GuildVoice) {
            console.log('❌ Canal de voz não encontrado');
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
            
            // Tocar JordanShop.mp3 em loop infinito
            const audioPath = path.join(__dirname, '..', '..', 'audio', 'JordanShop.mp3');
            tocarAudioLoopInfinito(audioPath);
        });

        voiceConnection.on('error', (err) => {
            console.error('❌ Erro na conexão de voz:', err);
        });

    } catch (err) {
        console.error('❌ Erro ao entrar no canal de voz:', err);
    }
}

// ============================================================================
// 2. ÁUDIO EM LOOP INFINITO (QUANDO TERMINA, VOLTA A TOCAR)
// ============================================================================

async function tocarAudioLoopInfinito(audioPath) {
    try {
        if (!fs.existsSync(audioPath)) {
            console.error(`❌ Ficheiro não encontrado: ${audioPath}`);
            return false;
        }

        // Criar player se não existir
        if (!audioPlayer) {
            audioPlayer = createAudioPlayer();
            
            // QUANDO TERMINA, VOLTA A TOCAR (LOOP INFINITO)
            audioPlayer.on(AudioPlayerStatus.Idle, () => {
                console.log("🎵 Música terminou, reiniciando loop infinito...");
                tocarAudioLoopInfinito(audioPath);
            });

            audioPlayer.on(AudioPlayerStatus.Playing, () => {
                console.log("🎵 A tocar:", path.basename(audioPath));
            });

            audioPlayer.on('error', (err) => {
                console.error("❌ Erro no player:", err.message);
                setTimeout(() => tocarAudioLoopInfinito(audioPath), 5000);
            });
        }

        // Criar recurso de áudio
        currentResource = createAudioResource(audioPath, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });

        // Ajustar volume
        if (currentResource.volume) {
            currentResource.volume.setVolume(currentVolume);
        }

        // Tocar
        audioPlayer.play(currentResource);
        
        // Subscrever à conexão
        if (voiceConnection) {
            voiceConnection.subscribe(audioPlayer);
        }

        return true;

    } catch (err) {
        console.error("❌ Erro ao tocar áudio:", err);
        setTimeout(() => tocarAudioLoopInfinito(audioPath), 10000);
        return false;
    }
}

// ============================================================================
// 3. CONTROLO DO ÁUDIO (STOP, VOLUME, ETC)
// ============================================================================

function pararAudio() {
    if (audioPlayer) {
        audioPlayer.stop();
        console.log("🛑 Áudio parado");
        return true;
    }
    return false;
}

function ajustarVolume(nivel) {
    // nivel de 0 a 100
    currentVolume = Math.max(0, Math.min(100, nivel)) / 100;
    
    if (currentResource && currentResource.volume) {
        currentResource.volume.setVolume(currentVolume);
        console.log(`🔊 Volume ajustado para ${Math.round(currentVolume * 100)}%`);
        return true;
    }
    return false;
}

// ============================================================================
// 4. COMANDO SLASH /AUDIO
// ============================================================================

async function registrarComandoAudio(client) {
    try {
        const comando = new SlashCommandBuilder()
            .setName('audio')
            .setDescription('🎵 Controlar música no canal de voz')
            .addSubcommand(sub =>
                sub.setName('play')
                   .setDescription('Tocar JordanShop.mp3')
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

        const guild = await client.guilds.fetch("1393629457599828040");
        await guild.commands.create(comando);
        console.log('✅ Comando /audio registado');

    } catch (err) {
        console.error('❌ Erro ao registar /audio:', err);
    }
}

async function handleAudioCommand(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    if (interaction.commandName !== 'audio') return false;

    const subcommand = interaction.options.getSubcommand();
    const audioPath = path.join(__dirname, '..', '..', 'audio', 'JordanShop.mp3');

    switch (subcommand) {
        case 'play':
            const sucesso = await tocarAudioLoopInfinito(audioPath);
            if (sucesso) {
                await interaction.reply('🎵 JordanShop.mp3 em loop infinito!');
            } else {
                await interaction.reply('❌ Erro ao tocar ficheiro');
            }
            break;

        case 'stop':
            if (pararAudio()) {
                await interaction.reply('🛑 Áudio parado');
            } else {
                await interaction.reply('❌ Nenhum áudio a tocar');
            }
            break;

        case 'volume':
            const nivel = interaction.options.getInteger('nivel');
            if (ajustarVolume(nivel)) {
                await interaction.reply(`🔊 Volume ajustado para ${nivel}%`);
            } else {
                await interaction.reply('❌ Não foi possível ajustar volume');
            }
            break;
    }

    return true;
}

// ============================================================================
// 5. EMBED DE SUPORTE (3 IDIOMAS) - SÓ ENVIA UMA VEZ
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

        // Verificar se já existe
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
// 6. FORMULÁRIOS - SÓ ENVIA UMA VEZ
// ============================================================================

async function enviarFormularios(client) {
    try {
        if (embedsEnviados.has(CANAL_FORMULARIO_ID)) {
            console.log('ℹ️ Formulários já enviados anteriormente');
            return;
        }

        const canal = await client.channels.fetch(CANAL_FORMULARIO_ID);
        if (!canal) return console.log('❌ Canal de formulários não encontrado');

        // Verificar se já existe
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
// 7. CRIAR TICKET (COM CATEGORIA)
// ============================================================================

async function criarTicket(interaction, tipo, idioma) {
    const { guild, user, member } = interaction;
    
    const nomes = {
        pt: { suporte: 'suporte', compra: 'compra', tecnico: 'tecnico' },
        es: { suporte: 'soporte', compra: 'compra', tecnico: 'tecnico' },
        en: { suporte: 'support', compra: 'purchase', tecnico: 'technical' }
    };

    const prefixo = nomes[idioma][tipo];
    const nomeCanal = `ticket-${prefixo}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

    try {
        // Verificar se já existe ticket aberto
        const ticketExistente = guild.channels.cache.find(ch => 
            ch.name.includes(`ticket-${prefixo}-${user.username.toLowerCase()}`) &&
            ch.parentId === CATEGORIA_TICKETS_ID
        );

        if (ticketExistente) {
            return interaction.reply({
                content: `❌ Já tens um ticket aberto: ${ticketExistente}`,
                flags: [64]
            });
        }

        // Criar canal de ticket
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

        // Textos por idioma
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

        await interaction.reply({
            content: `✅ Ticket criado: ${ticketChannel}`,
            flags: [64]
        });

    } catch (err) {
        console.error('❌ Erro ao criar ticket:', err);
        await interaction.reply({
            content: '❌ Erro ao criar ticket. Contacta um administrador.',
            flags: [64]
        });
    }
}

// ============================================================================
// 8. HANDLERS DE INTERAÇÃO
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

    await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
}

async function handleFormBug(interaction) {
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
    
    await interaction.showModal(modal);
}

async function handleFormIdeia(interaction) {
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
    await interaction.showModal(modal);
}

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

    await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
}

async function handleAvaliacaoEstrelas(interaction, estrelas) {
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
    await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
    const { customId, fields, user } = interaction;
    
    // Enviar para canal de logs
    const LOG_ID = process.env.LOG_CHANNEL_ID || "1437076921627181228";
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
        
        await interaction.reply({ content: '✅ Bug reportado com sucesso! Obrigado.', flags: [64] });
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
        
        await interaction.reply({ content: '💡 Obrigado pela tua sugestão!', flags: [64] });
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
        
        await interaction.reply({ 
            content: `⭐ Obrigado pela tua avaliação de ${estrelas} estrelas!`, 
            flags: [64] 
        });
    }
}

// ============================================================================
// 9. HANDLER PRINCIPAL
// ============================================================================

async function handleSistemaInteraction(interaction, client) {
    // Comando /audio
    if (interaction.isChatInputCommand() && interaction.commandName === 'audio') {
        await handleAudioCommand(interaction);
        return true;
    }
    
    // Menu de idioma
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_suporte_idioma') {
        await handleMenuSuporte(interaction);
        return true;
    }
    
    // Botões de ticket (suporte, compra, tecnico)
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
            return interaction.reply({ content: '❌ Este não é um canal de ticket.', flags: [64] });
        }
        await interaction.reply('🔒 A fechar ticket em 5 segundos...');
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
    registrarComandoAudio,
    handleAudioCommand,
};
