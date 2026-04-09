const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

const STAFF_CHAMAR_ROLES = [
    "1393658593131233421",
    "1447241549489639661",
    "1421595512477450373",
    "1393658417884823662",
    "1393658313006383176"
];

const CHAMAR_COOLDOWN_MS = 2 * 60 * 1000;
const cooldownsChamar = new Map();

// ← SUBSTITUIR ESTA FUNÇÃO PELA VERSÃO COM DEBUG
async function registrarComandoChamar(client) {
    try {
        const comando = new SlashCommandBuilder()
            .setName('chamar')
            .setDescription('📞 Chamar o cliente que abriu o ticket (Staff Only)')
        
        const guildId = process.env.GUILD_ID;
        console.log('📝 GUILD_ID:', guildId); // ← DEBUG
        
        if (guildId) {
            const guild = await client.guilds.fetch(guildId);
            console.log('📝 Guild encontrada:', guild.name); // ← DEBUG
            const result = await guild.commands.create(comando);
            console.log('✅ Comando /chamar registado:', result.name); // ← DEBUG
        } else {
            console.log('⚠️ GUILD_ID não definido, a registar globalmente'); // ← DEBUG
            await client.application.commands.create(comando);
            console.log('✅ Comando /chamar registado globalmente');
        }
    } catch (err) {
        console.error('❌ Erro ao registar /chamar:', err);
    }
}

async function handleChamarCommand(interaction, client) {
    const { member, user, guild, channel } = interaction;
    
    await interaction.deferReply({ flags: [64] });
    
    const isStaff = STAFF_CHAMAR_ROLES.some(id => member.roles.cache.has(id));
    if (!isStaff) {
        return interaction.editReply({
            content: '❌ **Acesso Negado!** Apenas Staff pode usar este comando.',
        });
    }
    
    if (!channel.name.startsWith('ticket-') && !channel.name.startsWith('staff-')) {
        return interaction.editReply({
            content: '❌ Este comando só pode ser usado em canais de ticket!',
        });
    }
    
    const now = Date.now();
    const userCooldown = cooldownsChamar.get(user.id);
    
    if (userCooldown && now < userCooldown) {
        const remaining = userCooldown - now;
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const tempoFormatado = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        
        const embedCooldown = new EmbedBuilder()
            .setTitle('⏰ Cooldown Ativo')
            .setDescription(
                `**Tempo Restante:** \`\`${tempoFormatado}\`\`\n\n` +
                `💡 Cada membro da Staff tem um cooldown de **2 minutos** entre chamadas.`
            )
            .setColor('#ff9900')
            .setFooter({ text: user.tag, iconURL: user.displayAvatarURL() })
            .setTimestamp();
            
        return interaction.editReply({ embeds: [embedCooldown] });
    }
    
    const topic = channel.topic;
    if (!topic) {
        return interaction.editReply({
            content: '❌ Não foi possível identificar o cliente deste ticket!',
        });
    }
    
    const clienteId = topic.split('|')[0];
    if (!clienteId || !/^\d{17,19}$/.test(clienteId)) {
        return interaction.editReply({
            content: '❌ ID do cliente inválido no tópico do canal!',
        });
    }
    
    let clienteMember;
    try {
        clienteMember = await Promise.race([
            guild.members.fetch({ user: clienteId, force: true }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
            )
        ]);
    } catch (err) {
        const embedSaiu = new EmbedBuilder()
            .setTitle('👋 Cliente Saiu do Servidor')
            .setDescription(
                `O cliente <@${clienteId}> **não está mais presente** neste ticket.\n\n` +
                `🔒 Podes fechar o ticket se desejares.`
            )
            .setColor('#ff0000')
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`fechar_ticket_saida_${channel.id}`)
                .setLabel('🔒 Fechar Ticket')
                .setStyle(ButtonStyle.Danger)
        );
        
        return interaction.editReply({ 
            embeds: [embedSaiu], 
            components: [row]
        });
    }
    
    cooldownsChamar.set(user.id, now + CHAMAR_COOLDOWN_MS);
    setTimeout(() => cooldownsChamar.delete(user.id), CHAMAR_COOLDOWN_MS);
    
    try {
        const embedDM = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('📞 Chamada de Staff')
            .setDescription(
                `O staff **${user.username}** chamou-te em ${channel}`
            )
            .setTimestamp();
        
        const rowDM = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir para o Ticket')
                .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
                .setStyle(ButtonStyle.Link)
        );
        
        await clienteMember.send({ 
            embeds: [embedDM], 
            components: [rowDM] 
        });
        
    } catch (err) {
        return interaction.editReply({
            content: `❌ Não foi possível chamar **${clienteMember.user.username}** (DMs fechadas).`,
        });
    }
    
    const embedConfirm = new EmbedBuilder()
        .setTitle('✅ Cliente Chamado!')
        .setDescription(
            `**Staff:** <@${user.id}>\n` +
            `**Cliente:** <@${clienteId}>\n` +
            `**Canal:** ${channel}\n\n` +
            `⏰ **Cooldown:** 2 minutos ativos.`
        )
        .setColor('#00ff00')
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embedConfirm] });
    
    setImmediate(async () => {
        try {
            const logId = process.env.LOG_CHANNEL_ID || "1437076921627181228";
            const logChannel = await guild.channels.fetch(logId);
            if (logChannel) {
                const embedLog = new EmbedBuilder()
                    .setTitle('📞 Staff Chamou Cliente')
                    .setDescription(
                        `**Staff:** <@${user.id}> (${user.tag})\n` +
                        `**Cliente:** <@${clienteId}> (${clienteMember.user.tag})\n` +
                        `**Ticket:** ${channel.name}`
                    )
                    .setColor('#8b0000')
                    .setTimestamp();
                await logChannel.send({ embeds: [embedLog] });
            }
        } catch (err) {
            console.error('Erro ao enviar log:', err);
        }
    });
}

async function handleFecharTicketSaida(interaction, client) {
    const { member, channel } = interaction;
    
    const isStaff = STAFF_CHAMAR_ROLES.some(id => member.roles.cache.has(id));
    if (!isStaff) {
        return interaction.reply({ content: 'Apenas Staff!', flags: [64] });
    }
    
    await interaction.reply('🔒 A fechar ticket em 5 segundos...');
    setTimeout(() => channel.delete().catch(() => {}), 5000);
}

module.exports = {
    registrarComandoChamar,
    handleChamarCommand,
    handleFecharTicketSaida,
    STAFF_CHAMAR_ROLES,
    cooldownsChamar
};
