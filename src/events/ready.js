const { EmbedBuilder, ActivityType } = require("discord.js");

module.exports = async (client) => {
    // IMPORTANTE: Mantemos 'ready' para o status funcionar
    client.once("ready", async () => {
        const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

        console.log(`✅ Jordan Shop Online: ${client.user.tag}`);

        // Define a atividade para aparecer a "Competir"
        client.user.setPresence({ 
            activities: [{ 
                name: "Jordan Shop | discord.gg/6hhZeqb7Qk", 
                type: ActivityType.Competing 
            }], 
            status: "online" 
        });

        // Envio do Log de Inicialização (como tinhas antes)
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
