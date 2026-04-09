
# Criar o sistema /chamar para Staff com cooldown de 2 minutos
# Baseado na imagem: embed com "Chamada de Staff", menção do cliente e botão para o ticket

codigo_chamar_staff = """
// ============================================================================
// COMANDO /CHAMAR - STAFF ONLY (Versão para chamar users que abriram tickets)
// Integração com Jordan.Shop-Bot-Site
// ============================================================================

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

// IDs dos cargos que podem usar o comando
const STAFF_CHAMAR_ROLES = [
    "1393658593131233421",  // Owner
    "1447241549489639661",  // Developer  
    "1421595512477450373",  // Support
    "1393658417884823662",  // Moderador
    "1393658313006383176"   // Staff
];

// Cooldown: 2 minutos por staff
const CHAMAR_COOLDOWN_MS = 2 * 60 * 1000;
const cooldownsChamar = new Map();

// ============================================================================
// REGISTO DO COMANDO /CHAMAR
// ============================================================================

async function registrarComandoChamar(client) {
    try {
        const comando = new SlashCommandBuilder()
            .setName('chamar')
            .setDescription('📞 Chamar o cliente que abriu o ticket (Staff Only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands);

        const guildId = process.env.GUILD_ID;
        if (guildId) {
            const guild = await client.guilds.fetch(guildId);
            await guild.commands.create(comando);
            console.log('✅ Comando /chamar registado em:', guild.name);
        } else {
            await client.application.commands.create(comando);
            console.log('✅ Comando /chamar registado globalmente');
        }
    } catch (err) {
        console.error('❌ Erro ao registar /chamar:', err);
    }
}

// ============================================================================
// HANDLER DO COMANDO /CHAMAR
// ============================================================================

async function handleChamarCommand(interaction, client) {
    const { member, user, guild, channel } = interaction;
    
    // 1. VERIFICAR SE É STAFF
    const isStaff = STAFF_CHAMAR_ROLES.some(id => member.roles.cache.has(id));
    if (!isStaff) {
        return interaction.reply({
            content: '❌ **Acesso Negado!** Apenas Staff pode usar este comando.',
            flags: [64]
        });
    }
    
    // 2. VERIFICAR SE ESTÁ NUM CANAL DE TICKET
    // Verifica se o canal começa com "ticket-" ou "staff-" (os teus tickets)
    if (!channel.name.startsWith('ticket-') && !channel.name.startsWith('staff-')) {
        return interaction.reply({
            content: '❌ Este comando só pode ser usado em canais de ticket!',
            flags: [64]
        });
    }
    
    // 3. VERIFICAR COOLDOWN (2 minutos)
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
                `**Tempo Restante:** \\`\\`${tempoFormatado}\\`\\`\\n\\n` +
                `💡 Cada membro da Staff tem um cooldown de **2 minutos** entre chamadas.`
            )
            .setColor('#ff9900')
            .setFooter({ text: user.tag, iconURL: user.displayAvatarURL() })
            .setTimestamp();
            
        return interaction.reply({ embeds: [embedCooldown], flags: [64] });
    }
    
    // 4. OBTER O CLIENTE DO TÓPICO DO CANAL
    // O teu bot guarda no topic: "userId|motivo|tipo|timestamp"
    const topic = channel.topic;
    if (!topic) {
        return interaction.reply({
            content: '❌ Não foi possível identificar o cliente deste ticket!',
            flags: [64]
        });
    }
    
    const clienteId = topic.split('|')[0];
    if (!clienteId || !/^\\d{17,19}$/.test(clienteId)) {
        return interaction.reply({
            content: '❌ ID do cliente inválido no tópico do canal!',
            flags: [64]
        });
    }
    
    // 5. BUSCAR O CLIENTE
    let cliente;
    try {
        cliente = await client.users.fetch(clienteId);
    } catch (err) {
        return interaction.reply({
            content: '❌ Não foi possível encontrar o cliente (pode ter saído do servidor).',
            flags: [64]
        });
    }
    
    // 6. DEFINIR COOLDOWN
    cooldownsChamar.set(user.id, now + CHAMAR_COOLDOWN_MS);
    setTimeout(() => cooldownsChamar.delete(user.id), CHAMAR_COOLDOWN_MS);
    
    // 7. ENVIAR DM AO CLIENTE (igual à imagem)
    try {
        const embedDM = new EmbedBuilder()
            .setColor('#2b2d31') // Cor escura do Discord
            .setTitle('📞 Chamada de Staff')
            .setDescription(
                `O cliente **${cliente.username}** chamou-te em ${channel}`
            )
            .setTimestamp();
        
        const rowDM = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir para o Ticket')
                .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
                .setStyle(ButtonStyle.Link)
        );
        
        await cliente.send({ 
            embeds: [embedDM], 
            components: [rowDM] 
        });
        
    } catch (err) {
        console.log(`⚠️ Não foi possível enviar DM para ${cliente.tag} (DMs fechadas)`);
        return interaction.reply({
            content: `❌ Não foi possível chamar **${cliente.username}** (DMs fechadas).`,
            flags: [64]
        });
    }
    
    // 8. CONFIRMAÇÃO NO CANAL
    const embedConfirm = new EmbedBuilder()
        .setTitle('✅ Cliente Chamado!')
        .setDescription(
            `**Staff:** <@${user.id}>\\n` +
            `**Cliente:** <@${cliente.id}>\\n` +
            `**Canal:** ${channel}\\n\\n` +
            `⏰ **Cooldown:** 2 minutos ativos.`
        )
        .setColor('#00ff00')
        .setTimestamp();
    
    await interaction.reply({ embeds: [embedConfirm] });
    
    // 9. LOG
    try {
        const logId = process.env.LOG_CHANNEL_ID || "1437076921627181228";
        const logChannel = await guild.channels.fetch(logId);
        if (logChannel) {
            const embedLog = new EmbedBuilder()
                .setTitle('📞 Staff Chamou Cliente')
                .setDescription(
                    `**Staff:** <@${user.id}> (${user.tag})\\n` +
                    `**Cliente:** <@${cliente.id}> (${cliente.tag})\\n` +
                    `**Ticket:** ${channel.name}`
                )
                .setColor('#8b0000')
                .setTimestamp();
            await logChannel.send({ embeds: [embedLog] });
        }
    } catch (err) {
        console.error('Erro ao enviar log:', err);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    registrarComandoChamar,
    handleChamarCommand,
    STAFF_CHAMAR_ROLES,
    cooldownsChamar
};
"""

print(codigo_chamar_staff)
