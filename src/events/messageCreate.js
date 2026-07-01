const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Cor vermelha escura estilo NX
const COR_NX = 0x660000;

// Canal de logs
const LOGS_CHANNEL_ID = "1437076921627181228";

module.exports = async (client, message) => {
    // 1. Ignorar se for bot ou se nao for num servidor
    if (message.author.bot || !message.guild) return;

    // 2. Verificar se o canal e um ticket (ex: comeca por ticket-)
    if (!message.channel.name.startsWith("ticket-")) return;

    // 3. Lista da Staff (IDs que podem disparar o aviso)
    const staffIDs = ["924344854232834068", "996454465555136675", "1476260824669618307", "1138795786507919410", "886007990942052362"];
    
    // Se quem escreveu nao for da Staff, nao fazemos nada
    if (!staffIDs.includes(message.author.id)) return;

    try {
        // 4. Buscar o ID do cliente no topico do canal
        const topic = message.channel.topic;
        if (!topic) {
            console.log(`[TICKET NOTIFY] Canal ${message.channel.name} sem topico.`);
            return;
        }

        // Pegamos apenas o ID que esta antes do primeiro "|"
        const clienteId = topic.split("|")[0];
        const cliente = await client.users.fetch(clienteId).catch(() => null);
        if (!cliente) {
            console.log(`[TICKET NOTIFY] Nao consegui encontrar o cliente com ID ${clienteId}.`);
            return;
        }

        // === LOG NO CANAL 1437076921627181228 ===
        const canalLogs = await client.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        if (canalLogs) {
            const embedLog = new EmbedBuilder()
                .setColor(COR_NX)
                .setTitle("📨 Notificacao de Ticket Enviada")
                .setDescription([
                    `**Staff:** <@${message.author.id}> (${message.author.username})`,
                    `**Cliente:** <@${cliente.id}> (${cliente.username})`,
                    `**Canal:** <#${message.channel.id}> (\`${message.channel.name}\`)`,
                    `**Mensagem:** [Ver mensagem](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id})`
                ].join('\n'))
                .setTimestamp();
            await canalLogs.send({ embeds: [embedLog] }).catch(() => {});
        }

        // 5. Criar o aviso para a DM do cliente — ESTILO NX
        const embedDM = new EmbedBuilder()
            .setColor(COR_NX)
            .setDescription([
                `👋 | Olá **${cliente.username}**,`,
                ``,
                `🔔 | Seu ticket recebeu uma atualização.`,
                ``,
                `> 📋 Ticket: \`${message.channel.name}\``,
                `> ⏰ Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>`
            ].join('\n'))
            .setTimestamp();

        const botaoIr = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("🔗 Ir para o Ticket")
                .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
        );

        // Enviar a DM com a mencao fora do embed
        await cliente.send({ 
            content: `<@${cliente.id}>`,
            embeds: [embedDM], 
            components: [botaoIr] 
        }).then(() => {
            console.log(`[TICKET NOTIFY] DM enviada com sucesso para ${cliente.username} (${clienteId})`);
        }).catch((err) => {
            console.log(`[DM FECHADA] Nao consegui avisar o ${cliente.username} (${clienteId}) — DMs fechadas ou bloqueou o bot.`);
            // Log no canal que a DM falhou
            if (canalLogs) {
                canalLogs.send(`⚠️ **DM Fechada:** Nao consegui notificar <@${cliente.id}> (${cliente.username}) no ticket \`${message.channel.name}\`.`).catch(() => {});
            }
        });

    } catch (err) {
        console.error("Erro ao processar notificacao de staff:", err);
    }
};
