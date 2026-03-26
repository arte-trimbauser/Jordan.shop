
const { EmbedBuilder, ActivityType } = require("discord.js");

module.exports = async (client) => {
    // Mensagens no Terminal do Render
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Site: https://jordan-shop.onrender.com/`);
    console.log(`✅ Bot online como: ${client.user.tag}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    // --- CONFIGURAÇÃO DO STATUS ROTATIVO ---
    const statusList = [
            { name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Competing },
            { name: "Os melhores preços!", type: ActivityType.Watching },
            { name: "Jordan Shop #100", type: ActivityType.Listening },
            { name: "MELHOR LOJA DE CHE4TS DE PORTUGAL!!!", type: ActivityType.Playing }
        ];

    let i = 0;
    const updateStatus = () => {
        client.user.setPresence({
            activities: [statusList[i]],
            status: "online"
        });
        i = (i + 1) % statusList.length;
    };

    // Inicia o ciclo de status (muda a cada 5 segundos)
    updateStatus();
    setInterval(updateStatus, 5000);

    // --- ENVIO DO LOG DE INICIALIZAÇÃO NO DISCORD ---
    const LOG_ID = process.env.LOG_CHANNEL_ID || "1437076921627181228";
    
    try {
        const logChannel = await client.channels.fetch(LOG_ID).catch(() => null);
        if (logChannel) {
            const now = new Date();
            const hora = now.toLocaleTimeString("pt-PT");

            const embedLog = new EmbedBuilder()
                .setTitle("✅ Bot está online!")
                .setDescription(`O bot foi iniciado com sucesso e está pronto para uso.\n\n🕒 **Hora:** ${hora}`)
                .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp")
                .setThumbnail(client.user.displayAvatarURL())
                .setColor("#00ff00")
                .setFooter({ text: "Jordan Shop System", iconURL: client.user.displayAvatarURL() });

            await logChannel.send({ embeds: [embedLog] });
        }
    } catch (err) {
        console.error("Erro ao enviar log de inicialização no Discord.");
    }
};
