const { EmbedBuilder, ActivityType } = require("discord.js");

module.exports = async (client) => {
    client.once("ready", async () => {
        const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

        console.log(`✅ Jordan Shop Online: ${client.user.tag}`);

        // --- SISTEMA DE STATUS ROTATIVO ---
        const statusList = [
            { name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Competing },
            { name: "Os melhores preços!", type: ActivityType.Watching },
            { name: "Jordan Shop #100", type: ActivityType.Listening },
            { name: "MELHOR LOJA DE CHE4TS DE PORTUGAL!!!", type: ActivityType.Playing }
        ];

        let i = 0;
        setInterval(() => {
            client.user.setPresence({
                activities: [statusList[i]],
                status: "online"
            });
            
            // Muda para o próximo status, se chegar ao fim volta ao início
            i = (i + 1) % statusList.length;
        }, 15000); // 15000ms = 15 segundos (tempo ideal para o Discord não te dar block)
        // ----------------------------------

        // Envio do Log de Inicialização
        if (LOG_CHANNEL_ID) {
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const now = new Date();
                    const hora = now.toLocaleTimeString("pt-PT");

                    await logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("✅ Bot está online!")
                                .setDescription(`O bot foi iniciado com sucesso e está pronto para uso.\n\n🕒 Hora: ${hora}`)
                                .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp")
                                .setColor("#00ff00")
                        ]
                    });
                }
            } catch (err) {
                console.error("Erro ao enviar log de inicialização.");
            }
        }
    });
};
