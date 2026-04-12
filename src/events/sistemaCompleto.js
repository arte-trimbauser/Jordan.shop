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
    ChannelType
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');

// IDs dos canais
const CANAL_VOZ_ID = "1492521949736472757";
const CANAL_TICKET_ID = "1393946650128679092";
const CANAL_FORMULARIO_ID = "1490783323780419664";

// Emojis personalizados (usando os IDs que forneceste)
const EMOJIS = {
    pt: "<:portugues:1492525538416267536>",
    es: "<:espanhol:1492525567889641583>",
    en: "<:ingles:1492526158309359726>"
};

// ============================================================================
// 1. BOT ENTRA NO CANAL DE VOZ
// ============================================================================

async function entrarCanalVoz(client) {
    try {
        const guild = client.guilds.cache.first();
        const canal = await guild.channels.fetch(CANAL_VOZ_ID);
        
        if (!canal || canal.type !== ChannelType.GuildVoice) {
            console.log('❌ Canal de voz não encontrado');
            return;
        }

        const connection = joinVoiceChannel({
            channelId: canal.id,
            guildId: canal.guild.id,
            adapterCreator: canal.guild.voiceAdapterCreator,
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log('✅ Bot entrou no canal de voz:', canal.name);
        });

    } catch (err) {
        console.error('❌ Erro ao entrar no canal de voz:', err);
    }
}

// ============================================================================
// 2. EMBED DE SUPORTE COM 3 IDIOMAS
// ============================================================================

async function enviarEmbedSuporte(client) {
    try {
        const canal = await client.channels.fetch(CANAL_TICKET_ID);
        if (!canal) return console.log('❌ Canal de suporte não encontrado');

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
            .setFooter({ text: 'Jordan Shop | Sistema de Suporte' })
            .setTimestamp();

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
        console.log('✅ Embed de suporte enviado');

    } catch (err) {
        console.error('❌ Erro ao enviar embed:', err);
    }
}

// ============================================================================
// 3. FORMULÁRIOS: BUG, IDEIAS, AVALIAÇÃO
// ============================================================================

async function enviarFormularios(client) {
    try {
        const canal = await client.channels.fetch(CANAL_FORMULARIO_ID);
        if (!canal) return console.log('❌ Canal de formulários não encontrado');

        const embed = new EmbedBuilder()
            .setTitle('📋 Centro de Feedback - Jordan Shop')
            .setDescription(
                'Bem-vindo ao centro de feedback! Escolhe uma opção abaixo:\n\n' +
                `🐛 **Reportar Bug** - Encontras-te algum problema?\n` +
                `💡 **Ideias** - Tens sugestões para melhorar?\n` +
                `⭐ **Avaliar Bot** - Dá-nos a tua opinião (1-5 estrelas)`
            )
            .setColor('#8b0000')
            .setFooter({ text: 'A tua opinião é importante!' })
            .setTimestamp();

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
        console.log('✅ Formulários enviados');

    } catch (err) {
        console.error('❌ Erro ao enviar formulários:', err);
    }
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleMenuSuporte(interaction) {
    const idioma = interaction.values[0];
    
    const textos = {
        pt: { titulo: '🎫 Criar Ticket', desc: 'Escolhe o tipo:', suporte: 'Suporte Geral', compra: 'Ajuda com Compra', tecnico: 'Problema Técnico' },
        es: { titulo: '🎫 Crear Ticket', desc: 'Elige el tipo:', suporte: 'Soporte General', compra: 'Ayuda con Compra', tecnico: 'Problema Técnico' },
        en: { titulo: '🎫 Create Ticket', desc: 'Choose type:', suporte: 'General Support', compra: 'Purchase Help', tecnico: 'Technical Issue' }
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
        .setPlaceholder('Olá vimos que você clicou na opção Bug poderá nos especificar que bug encontrou no bot?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

    const input2 = new TextInputBuilder()
        .setCustomId('canal_bug')
        .setLabel('Pode identificar qual foi o canal ou o canal id')
        .setPlaceholder('Ex: #geral ou 123456789')
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
        .setTitle('💡 Ideias e Sugestões');

    const input = new TextInputBuilder()
        .setCustomId('descricao_ideia')
        .setLabel('Que ideia tem ou em que quer nos melhoramos no bot')
        .setPlaceholder('Descreve a tua ideia...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleFormAvaliar(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('⭐ Avalia o Jordan Shop')
        .setDescription('Quantas estrelas dás ao nosso bot?')
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
        .setLabel('Porquê?')
        .setPlaceholder('Conta-nos o que gostaste ou não gostaste...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
    const { customId, fields } = interaction;
    
    if (customId === 'modal_bug') {
        const descricao = fields.getTextInputValue('descricao_bug');
        const canal = fields.getTextInputValue('canal_bug') || 'Não especificado';
        
        await interaction.reply({
            content: `✅ Bug reportado!\\n**Descrição:** ${descricao}\\n**Canal:** ${canal}`,
            flags: [64]
        });
    }
    else if (customId === 'modal_ideia') {
        const ideia = fields.getTextInputValue('descricao_ideia');
        await interaction.reply({ content: `💡 Ideia submetida: ${ideia}`, flags: [64] });
    }
    else if (customId.startsWith('modal_avaliacao_')) {
        const estrelas = customId.split('_')[2];
        const motivo = fields.getTextInputValue('motivo_avaliacao');
        await interaction.reply({ 
            content: `⭐ Avaliação: ${'⭐'.repeat(parseInt(estrelas))}\\n**Motivo:** ${motivo}`, 
            flags: [64] 
        });
    }
}

// ============================================================================
// HANDLER PRINCIPAL (para interactionCreate.js)
// ============================================================================

async function handleSistemaInteraction(interaction, client) {
    // Menu de idioma
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_suporte_idioma') {
        return await handleMenuSuporte(interaction);
    }
    
    // Botões
    if (interaction.isButton()) {
        if (interaction.customId === 'form_bug') return await handleFormBug(interaction);
        if (interaction.customId === 'form_ideia') return await handleFormIdeia(interaction);
        if (interaction.customId === 'form_avaliar') return await handleFormAvaliar(interaction);
        if (interaction.customId.startsWith('avaliar_')) {
            const estrelas = interaction.customId.split('_')[1];
            return await handleAvaliacaoEstrelas(interaction, estrelas);
        }
    }
    
    // Modais
    if (interaction.isModalSubmit()) {
        return await handleModalSubmit(interaction);
    }
}

module.exports = {
    entrarCanalVoz,
    enviarEmbedSuporte,
    enviarFormularios,
    handleSistemaInteraction
};
