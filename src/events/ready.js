const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ActivityType } = require("discord.js");
const menus = require("../menus");

module.exports = (client) => {
    client.once("ready", async () => {
        if (!client.user) return;

        // 1. STATUS / PRESENÇA
        client.user.setPresence({
            activities: [{ name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Watching }],
            status: "online"
        });

        // 2. LOG NO CANAL DO DISCORD (Se existir ID no .env)
        const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
        if (LOG_CHANNEL_ID) {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const now = new Date();
                const embedLog = new EmbedBuilder()
                    .setTitle("✅ Bot está online!")
                    .setDescription(`Iniciado com sucesso.\n\n🕒 **Hora:** ${now.toLocaleTimeString("pt-PT")}`)
                    .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp")
                    .setColor("#00ff00");
                await logChannel.send({ embeds: [embedLog] }).catch(() => {});
            }
        }

        // 3. ENVIO DOS MENUS NOS CANAIS
        for (const menu of menus) {
            try {
                const canal = await client.channels.fetch(menu.id).catch(() => null);
                if (!canal) continue;

                const lastMessages = await canal.messages.fetch({ limit: 10 }).catch(() => new Map());
                const alreadyPosted = Array.from(lastMessages.values()).some(m =>
                    m.author?.id === client.user.id &&
                    m.embeds?.some(e => e.title === menu.title)
                );

                if (alreadyPosted) continue;

                const embed = new EmbedBuilder()
                    .setTitle(menu.title)
                    .setDescription(menu.embedDesc)
                    .setColor("#ff0000");

                if (menu.embedImage) embed.setImage(menu.embedImage);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("menu_ticket")
                    .setPlaceholder("Escolhe uma opção")
                    .addOptions(menu.options);

                await canal.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(selectMenu)]
                });
            } catch (error) {
                console.error(`Erro no menu ${menu.title}:`, error.message);
            }
        }
    });
};
