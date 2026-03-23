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
        // No ficheiro messageCreate.js, altera para:
const topic = message.channel.topic;
if (!topic) return;

// Pegamos apenas o ID que está antes do primeiro "|"
const clienteId = topic.split("|")[0];
        const cliente = await client.users.fetch(clienteId).catch(() => null);
        if (!cliente) return;

// 5. Criar o aviso para a DM do cliente exatamente como no print
        const embedDM = new EmbedBuilder()
            .setColor("#2b2d31") // Cor escura para parecer o tema do Discord
            .setDescription("👋 | Olá **" + cliente.username + "**,\n🔔 | Seu ticket recebeu uma atualização. 😄");

        const botaoIr = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Ir para o Ticket")
                .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
                .setStyle(ButtonStyle.Link)
        );

        // Enviar a DM com a menção fora do embed
        await cliente.send({ 
            content: `<@${cliente.id}>`, // Menção fora do embed como na imagem
            embeds: [embedDM], 
            components: [botaoIr] 
        }).catch(() => {
            console.log(`❌ Não consegui avisar o ${cliente.username} (DMs fechadas).`);
        });

    } catch (err) {
        console.error("Erro ao processar notificação de staff:", err);
    }
};
