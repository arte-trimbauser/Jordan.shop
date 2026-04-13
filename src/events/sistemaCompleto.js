// src/events/sistemaCompleto.js
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionsBitField,
    ComponentType
} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

// ==================== CONFIGURAÇÕES ====================
const CONFIG = {
    // Canal de voz onde o bot vai entrar
    voiceChannelId: '1492521949736472757',
    
    // Canal do embed de suporte (3 idiomas)
    supportChannelId: '1393946650128679092',
    
    // Canal dos formulários
    formsChannelId: '1490783323780419664',
    
    // Emojis personalizados (substitua pelos seus IDs reais)
    emojis: {
        portugal: '<:portugal:EMOJI_ID_PT>',
        england: '<:england:EMOJI_ID_EN>',
        spain: '<:spain:EMOJI_ID_ES>',
        bug: '<:bug:EMOJI_ID_BUG>',
        idea: '<:idea:EMOJI_ID_IDEA>',
        star: '<:star:EMOJI_ID_STAR>',
        support: '<:support:EMOJI_ID_SUPPORT>'
    },
    
    // Categorias para tickets por idioma
    categories: {
        pt: '1492521949736472758', // Categoria tickets PT
        en: '1492521949736472759', // Categoria tickets EN
        es: '1492521949736472760'  // Categoria tickets ES
    }
};

// ==================== SISTEMA DE VOZ ====================
let voiceConnection = null;
let audioPlayer = null;

async function entrarCanalVoz(client) {
    try {
        const channel = await client.channels.fetch(CONFIG.voiceChannelId);
        if (!channel || channel.type !== ChannelType.GuildVoice) {
            console.error('❌ Canal de voz não encontrado ou inválido!');
            return;
        }

        voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        // Criar player de áudio (opcional - para tocar algo depois)
        audioPlayer = createAudioPlayer();
        voiceConnection.subscribe(audioPlayer);

        voiceConnection.on('error', (err) => {
            console.error('❌ Erro na conexão de voz:', err);
        });

        console.log(`✅ Bot entrou no canal de voz: ${channel.name}`);
    } catch (err) {
        console.error('❌ Erro ao entrar no canal de voz:', err);
    }
}

// ==================== EMBED DE SUPORTE (3 IDIOMAS) ====================
async function enviarEmbedSuporte(client) {
    try {
        const channel = await client.channels.fetch(CONFIG.supportChannelId);
        if (!channel) {
            console.error('❌ Canal de suporte não encontrado!');
            return;
        }

        // Embed Principal
        const embed = new EmbedBuilder()
            .setTitle(`${CONFIG.emojis.support} Jordan Shop | Central de Suporte`)
            .setDescription(
                `Bem-vindo à nossa central de suporte! Escolha o seu idioma abaixo.\n\n` +
                `${CONFIG.emojis.portugal} **Português** - Suporte em Português\n` +
                `${CONFIG.emojis.england} **English** - Support in English\n` +
                `${CONFIG.emojis.spain} **Español** - Soporte en Español`
            )
            .setColor('#8b0000')
            .setImage('https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp')
            .setFooter({ text: 'Jordan Shop © 2024', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // Menu de seleção de idioma
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_language_support')
                .setPlaceholder('🌍 Selecione seu idioma / Select your language')
                .addOptions([
                    {
                        label: 'Português',
                        description: 'Suporte em Português',
                        value: 'lang_pt',
                        emoji: CONFIG.emojis.portugal
                    },
                    {
                        label: 'English',
                        description: 'Support in English',
                        value: 'lang_en',
                        emoji: CONFIG.emojis.england
                    },
                    {
                        label: 'Español',
                        description: 'Soporte en Español',
                        value: 'lang_es',
                        emoji: CONFIG.emojis.spain
                    }
                ])
        );

        await channel.send({ embeds: [embed], components: [row] });
        console.log('✅ Embed de suporte enviado!');
    } catch (err) {
        console.error('❌ Erro ao enviar embed de suporte:', err);
    }
}

// ==================== FORMULÁRIOS ====================
async function enviarFormularios(client) {
    try {
        const channel = await client.channels.fetch(CONFIG.formsChannelId);
        if (!channel) {
            console.error('❌ Canal de formulários não encontrado!');
            return;
        }

        // Embed de Formulários
        const embed = new EmbedBuilder()
            .setTitle('📝 Jordan Shop | Formulários')
            .setDescription(
                `Ajude-nos a melhorar! Escolha uma opção abaixo:\n\n` +
                `${CONFIG.emojis.bug} **Reportar Bug** - Encontrou algum problema?\n` +
                `${CONFIG.emojis.idea} **Sugerir Ideia** - Tem uma sugestão?\n` +
                `${CONFIG.emojis.star} **Avaliar Bot** - Dê-nos a sua opinião!`
            )
            .setColor('#5865F2')
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: 'Jordan Shop © 2024', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // Botões para formulários
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('form_bug_report')
                .setLabel('🐛 Reportar Bug')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('form_idea_suggest')
                .setLabel('💡 Sugerir Ideia')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('form_rate_bot')
                .setLabel('⭐ Avaliar Bot')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });
        console.log('✅ Formulários enviados!');
    } catch (err) {
        console.error('❌ Erro ao enviar formulários:', err);
    }
}

// ==================== HANDLER DE INTERAÇÕES ====================
async function handleSistemaInteraction(interaction, client) {
    const { customId, user, guild, channel } = interaction;

    // ----- SELEÇÃO DE IDIOMA -----
    if (customId === 'select_language_support') {
        const idioma = interaction.values[0];
        const langData = {
            'lang_pt': { nome: 'Português', emoji: CONFIG.emojis.portugal, cat: CONFIG.categories.pt },
            'lang_en': { nome: 'English', emoji: CONFIG.emojis.england, cat: CONFIG.categories.en },
            'lang_es': { nome: 'Español', emoji: CONFIG.emojis.spain, cat: CONFIG.categories.es }
        };

        const selecionado = langData[idioma];
        
        // Verifica se já existe ticket aberto
        const ticketExistente = guild.channels.cache.find(ch => 
            ch.name === `ticket-${user.username.toLowerCase()}` && 
            ch.parentId === selecionado.cat
        );

        if (ticketExistente) {
            return interaction.reply({
                content: `❌ Já tens um ticket aberto: ${ticketExistente}`,
                flags: [64]
            });
        }

        // Criar ticket
        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username}`.toLowerCase(),
                type: ChannelType.GuildText,
                parent: selecionado.cat,
                topic: `${user.id}|${idioma}`,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    {
                        id: user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles]
                    }
                ]
            });

            const embedTicket = new EmbedBuilder()
                .setTitle(`${selecionado.emoji} Ticket de Suporte - ${selecionado.nome}`)
                .setDescription(
                    `Olá <@${user.id}>! Bem-vindo ao suporte em **${selecionado.nome}**.\n\n` +
                    `Descreva o seu problema e aguarde por um membro da staff.`
                )
                .setColor('#8b0000');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket_lang')
                    .setLabel('🔒 Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embedTicket], components: [row] });

            await interaction.reply({
                content: `✅ Ticket criado: ${ticketChannel}`,
                flags: [64]
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ Erro ao criar ticket.', flags: [64] });
        }
        return true;
    }

    // ----- FORMULÁRIO: REPORTAR BUG -----
    if (customId === 'form_bug_report') {
        const modal = {
            title: '🐛 Reportar Bug',
            custom_id: 'modal_bug_report',
            components: [
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'bug_titulo',
                        label: 'Título do Bug',
                        style: 1,
                        placeholder: 'Ex: Erro ao adicionar ao carrinho',
                        required: true,
                        max_length: 100
                    }]
                },
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'bug_descricao',
                        label: 'Descrição detalhada',
                        style: 2,
                        placeholder: 'Descreva o bug passo a passo...',
                        required: true,
                        max_length: 1000
                    }]
                }
            ]
        };
        await interaction.showModal(modal);
        return true;
    }

    // ----- FORMULÁRIO: SUGERIR IDEIA -----
    if (customId === 'form_idea_suggest') {
        const modal = {
            title: '💡 Sugerir Ideia',
            custom_id: 'modal_idea_suggest',
            components: [
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'idea_titulo',
                        label: 'Título da Ideia',
                        style: 1,
                        placeholder: 'Ex: Novo sistema de pontos',
                        required: true,
                        max_length: 100
                    }]
                },
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: 'idea_descricao',
                        label: 'Descrição da ideia',
                        style: 2,
                        placeholder: 'Explique a sua sugestão...',
                        required: true,
                        max_length: 1000
                    }]
                }
            ]
        };
        await interaction.showModal(modal);
        return true;
    }

    // ----- FORMULÁRIO: AVALIAR BOT -----
    if (customId === 'form_rate_bot') {
        const embed = new EmbedBuilder()
            .setTitle('⭐ Avalie o Bot')
            .setDescription('Quantas estrelas o bot merece?')
            .setColor('#FFD700');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rate_1').setLabel('⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rate_2').setLabel('⭐⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rate_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rate_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
        return true;
    }

    // ----- AVALIAÇÃO COM ESTRELAS -----
    if (customId?.startsWith('rate_')) {
        const estrelas = customId.replace('rate_', '');
        const stars = '⭐'.repeat(parseInt(estrelas));
        
        // Enviar para canal de logs
        const logChannel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID || "1437076921627181228");
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('⭐ Nova Avaliação')
                .setDescription(`**Utilizador:** <@${user.id}>\n**Avaliação:** ${stars}\n**Data:** <t:${Math.floor(Date.now()/1000)}:F>`)
                .setColor('#FFD700');
            await logChannel.send({ embeds: [embed] });
        }

        await interaction.update({ 
            content: `✅ Obrigado pela sua avaliação de ${stars}!`, 
            embeds: [], 
            components: [] 
        });
        return true;
    }

    // ----- MODAL SUBMIT: BUG -----
    if (customId === 'modal_bug_report') {
        const titulo = interaction.fields.getTextInputValue('bug_titulo');
        const descricao = interaction.fields.getTextInputValue('bug_descricao');

        const logChannel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID || "1437076921627181228");
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🐛 Novo Bug Reportado')
                .addFields(
                    { name: 'Utilizador', value: `<@${user.id}>`, inline: true },
                    { name: 'Título', value: titulo, inline: true },
                    { name: 'Descrição', value: descricao }
                )
                .setColor('#FF0000')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        await interaction.reply({ content: '✅ Bug reportado com sucesso! Obrigado.', flags: [64] });
        return true;
    }

    // ----- MODAL SUBMIT: IDEIA -----
    if (customId === 'modal_idea_suggest') {
        const titulo = interaction.fields.getTextInputValue('idea_titulo');
        const descricao = interaction.fields.getTextInputValue('idea_descricao');

        const logChannel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID || "1437076921627181228");
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('💡 Nova Sugestão')
                .addFields(
                    { name: 'Utilizador', value: `<@${user.id}>`, inline: true },
                    { name: 'Título', value: titulo, inline: true },
                    { name: 'Descrição', value: descricao }
                )
                .setColor('#5865F2')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        await interaction.reply({ content: '✅ Ideia enviada com sucesso! Obrigado.', flags: [64] });
        return true;
    }

    // ----- FECHAR TICKET DE IDIOMA -----
    if (customId === 'close_ticket_lang') {
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: '❌ Este não é um canal de ticket.', flags: [64] });
        }
        await interaction.reply('🔒 A fechar ticket em 5 segundos...');
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return true;
    }

    return false; // Não processou esta interação
}

module.exports = {
    entrarCanalVoz,
    enviarEmbedSuporte,
    enviarFormularios,
    handleSistemaInteraction,
    CONFIG
};
