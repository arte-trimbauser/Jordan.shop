const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const COR_NX = 0x660000;
const LOGS_CHANNEL_ID = "1437076921627181228";
const STAFF_IDS = [
    "924344854232834068",
    "996454465555136675",
    "1476260824669618307",
    "1138795786507919410",
    "886007990942052362"
];

const timers = new Map();
const timerCooldown = new Map();
const COOLDOWN_REINICIO = 30 * 1000; // 30 segundos

module.exports = async (client, message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.channel.name || !message.channel.name.startsWith("ticket-")) return;

    const topic = message.channel.topic;
    if (!topic) {
        console.log(`[TICKET TIMER] Canal ${message.channel.name} sem tópico.`);
        return;
    }
    const [clienteId] = topic.split("|");
    if (!clienteId) {
        console.log(`[TICKET TIMER] ID do cliente não encontrado.`);
        return;
    }

    const channelId = message.channel.id;
    const isStaff = STAFF_IDS.includes(message.author.id);

    // Se for cliente, cancela o temporizador
    if (!isStaff) {
        if (timers.has(channelId)) {
            clearTimeout(timers.get(channelId));
            timers.delete(channelId);
            timerCooldown.delete(channelId);
            console.log(`⏹️ Cliente respondeu, notificação cancelada para ${message.channel.name}`);
        }
        return;
    }

    // ===== STAFF =====
    const now = Date.now();
    const lastStart = timerCooldown.get(channelId);
    if (lastStart && (now - lastStart) < COOLDOWN_REINICIO) {
        // Ignora mensagens muito seguidas para não reiniciar o temporizador
        console.log(`⏭️ Ignorado reinício (cooldown) para ${message.channel.name}`);
        return;
    }

    // Cancela o temporizador existente
    if (timers.has(channelId)) {
        clearTimeout(timers.get(channelId));
        timers.delete(channelId);
    }

    // Regista o timestamp para cooldown
    timerCooldown.set(channelId, now);

    // Cria o temporizador de 10 minutos
    const timeout = setTimeout(async () => {
        try {
            timers.delete(channelId);
            timerCooldown.delete(channelId);

            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                console.log(`[TICKET TIMER] Canal ${channelId} já foi eliminado.`);
                return;
            }

            const cliente = await client.users.fetch(clienteId).catch(() => null);
            if (!cliente) {
                console.log(`[TICKET TIMER] Cliente ${clienteId} não encontrado.`);
                return;
            }

            const embedDM = new EmbedBuilder()
                .setColor(COR_NX)
                .setDescription(
                    `👋 | Olá **${cliente.username}**,\n\n` +
                    `🔔 | Seu ticket recebeu uma atualização. 😄`
                )
                .setTimestamp();

            const botaoIr = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("🎧 Ir para o Ticket ↗")
                    .setURL(`https://discord.com/channels/${message.guild.id}/${channelId}`)
                    .setStyle(ButtonStyle.Link)
            );

            await cliente.send({ embeds: [embedDM], components: [botaoIr] })
                .then(() => {
                    console.log(`[TICKET TIMER] DM atrasada enviada para ${cliente.username} (${clienteId})`);
                })
                .catch((err) => {
                    console.log(`[DM FECHADA] Não consegui avisar ${cliente.username} (${clienteId}) — DMs fechadas ou bloqueou o bot.`);
                });

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
    }, 10 * 60 * 1000);

    timers.set(channelId, timeout);
    console.log(`⏰ Temporizador de 10 min iniciado para ${message.channel.name} (Staff: ${message.author.username})`);
};
