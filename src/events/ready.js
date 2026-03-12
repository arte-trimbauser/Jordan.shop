const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ActivityType } = require("discord.js");
const menus = require("../menus");

module.exports = (client) => {
  // ISTO É O MAIS IMPORTANTE: O código só roda quando o bot está pronto.
  client.once("ready", async () => {
    console.log(`✅ Jordan Shop Online: ${client.user.tag}`);

    client.user.setPresence({
      activities: [{ name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Competing }],
      status: "online"
    });

    // Se tiveres o LOG_CHANNEL_ID no .env, ele envia a mensagem
    const logId = process.env.LOG_CHANNEL_ID;
    if (logId) {
      const canal = await client.channels.fetch(logId).catch(() => null);
      if (canal) {
        const embed = new EmbedBuilder()
          .setTitle("✅ Bot está online!")
          .setColor("#00ff00")
          .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp");
        await canal.send({ embeds: [embed] });
      }
    }

    // Envio dos Menus
    for (const menu of menus) {
      const canalMenu = await client.channels.fetch(menu.id).catch(() => null);
      if (canalMenu) {
        const embedM = new EmbedBuilder()
          .setTitle(menu.title)
          .setDescription(menu.embedDesc)
          .setColor("#ff0000");
        
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("menu_ticket")
            .setPlaceholder("Escolhe uma opção")
            .addOptions(menu.options)
        );
        await canalMenu.send({ embeds: [embedM], components: [row] });
      }
    }
  });
};
