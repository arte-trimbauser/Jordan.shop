const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = async (client, message) => {
    // 1. Ignorar se for bot ou se não for num servidor
    if (message.author.bot || !message.guild) return;

    // 2. Verificar se o canal é um ticket (ex: começa por ticket-)
    if (!message.channel.name.startsWith("ticket-")) return;

    // 3. Lista da tua Staff (IDs que podem disparar o aviso)
    const staffIDs = ["924344854232834068", "996454465555136675", "1476260824669618307", "1138795786507919410", "886007990942052362"];
    
    // Se quem escreveu não for da Staff, não fazemos nada
    if (!staffIDs.includes(message.author.id)) return;

    try {
        // 4. Buscar o ID do cliente no tópico do canal
        const clienteId = message.channel.topic;
        if (!clienteId) return;

        const cliente = await client.users.fetch(clienteId).catch(() => null);
        if (!cliente) return;

        // 5. Criar o aviso para a DM do cliente
        const embedDM = new EmbedBuilder()
            .setColor("#8b0000")
            .setTitle("🔔 Atualização no teu Ticket!")
            .setDescription(`Olá **${cliente.username}**,\nA Staff da **Jordan Shop** acabou de responder ao teu ticket!`)
            .addFields({ name: "Mensagem da Staff:", value: message.content.substring(0, 1024) || "*(Ficheiro ou Imagem)*" })
            .setFooter({ text: "Jordan Shop System" })
            .setTimestamp();

        const botaoIr = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Ir para o Ticket")
                .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
                .setStyle(ButtonStyle.Link)
        );

        // Enviar a DM
        await cliente.send({ embeds: [embedDM], components: [botaoIr] }).catch(() => {
            console.log(`Não consegui avisar o ${cliente.username} (DMs fechadas).`);
        });

    } catch (err) {
        console.error("Erro ao processar notificação de staff:", err);
    }
};
