const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Cor vermelha (igual à que já usavas)
const COR_NX = 0x660000;

// Canal de logs
const LOGS_CHANNEL_ID = "1437076921627181228";

// Lista da Staff (IDs fixos – podes manter ou ler do config)
const STAFF_IDS = [
    "924344854232834068",
    "996454465555136675",
    "1476260824669618307",
    "1138795786507919410",
    "886007990942052362"
];

// Mapa para guardar os temporizadores por canal
const timers = new Map();

module.exports = async (client, message) => {
    // 1. Ignorar bots e mensagens fora de servidor
    if (message.author.bot || !message.guild) return;

    // 2. Verificar se é um canal de ticket
    if (!message.channel.name || !message.channel.name.startsWith("ticket-")) return;

    // 3. Obter o ID do criador a partir do tópico
    const topic = message.channel.topic;
    if (!topic) {
        console.log(`[TICKET TIMER] Canal ${message.channel.name} sem tópico.`);
        return;
    }
    const [clienteId] = topic.split("|");
    if (!clienteId) {
        console.log(`[TICKET TIMER] ID do cliente não encontrado no tópico.`);
        return;
    }

    const channelId = message.channel.id;
    const isStaff = STAFF_IDS.includes(message.author.id);

    // ------------------------------
    // 4. SE FOR CLIENTE A RESPONDER → CANCELAR O TEMPORIZADOR
    // ------------------------------
    if (!isStaff) {
        if (timers.has(channelId)) {
            clearTimeout(timers.get(channelId));
            timers.delete(channelId);
            console.log(`⏹️ Cliente respondeu, notificação cancelada para ${message.channel.name}`);
        }
        return;
    }

    // ------------------------------
    // 5. SE FOR STAFF → INICIAR (OU REINICIAR) O TEMPORIZADOR
    // ------------------------------
    // Cancela qualquer temporizador existente
    if (timers.has(channelId)) {
        clearTimeout(timers.get(channelId));
        timers.delete(channelId);
    }

    // Cria um novo temporizador de 10 minutos
    const timeout = setTimeout(async () => {
        try {
            // Remove o timer do mapa (já que vai ser executado)
            timers.delete(channelId);

            // Verifica se o canal ainda existe
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                console.log(`[TICKET TIMER] Canal ${channelId} já foi eliminado.`);
                return;
            }

            // Busca o cliente
            const cliente = await client.users.fetch(clienteId).catch(() => null);
            if (!cliente) {
                console.log(`[TICKET TIMER] Cliente ${clienteId} não encontrado.`);
                return;
            }

            // ------------------------------
            // 6. ENVIAR A DM COM O FORMATO PEDIDO
            // ------------------------------
            const embedDM = new EmbedBuilder()
                .setColor(COR_NX)
                .setDescription(
                    `👋 | Olá **${cliente.username}**,\n\n` +
                    `🔔 | Seu ticket recebeu uma atualização. 😄`
                )
                .setTimestamp(); // Adiciona a data/hora automática (aparece no rodapé)

            const botaoIr = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("🎧 Ir para o Ticket ↗")
                    .setURL(`https://discord.com/channels/${message.guild.id}/${channelId}`)
                    .setStyle(ButtonStyle.Link)
            );

            // Envia a DM (sem menção, apenas o embed e o botão)
            await cliente.send({ embeds: [embedDM], components: [botaoIr] })
                .then(() => {
                    console.log(`[TICKET TIMER] DM atrasada enviada para ${cliente.username} (${clienteId})`);
                })
                .catch((err) => {
                    console.log(`[DM FECHADA] Não consegui avisar ${cliente.username} (${clienteId}) — DMs fechadas ou bloqueou o bot.`);
                });

            // ------------------------------
            // 7. LOG NO CANAL DE LOGS
            // ------------------------------
            const canalLogs = await client.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
            if (canalLogs) {
                const embedLog = new EmbedBuilder()
                    .setColor(COR_NX)
                    .setTitle("📨 Notificação Atrasada de Ticket")
                    .setDescription([
                        `**Staff:** <@${message.author.id}> (${message.author.username})`,
                        `**Cliente:** <@${clienteId}> (${cliente.username})`,
                        `**Canal:** <#${channelId}> (\`${message.channel.name}\`)`,
                        `**Tempo:** 10 minutos sem resposta do cliente.`
                    ].join('\n'))
                    .setTimestamp();
                await canalLogs.send({ embeds: [embedLog] }).catch(() => {});
            }

        } catch (err) {
            console.error("Erro ao executar temporizador de ticket:", err);
        }
    }, 10 * 60 * 1000); // ⏰ 10 minutos

    // Guarda o temporizador no mapa
    timers.set(channelId, timeout);
    console.log(`⏰ Temporizador de 10 min iniciado para ${message.channel.name} (Staff: ${message.author.username})`);
};
