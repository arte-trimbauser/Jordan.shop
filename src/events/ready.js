const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const menus = require("../menus");
const { LOG_CHANNEL_ID } = process.env;

module.exports = async (client) => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  client.user.setPresence({ 
    activities: [{ name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: 0 }], 
    status: "online" 
  });

  if (LOG_CHANNEL_ID) {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({ 
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Bot está online!")
            .setDescription("O bot foi iniciado com sucesso e está pronto para uso.")
            .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp")
            .setColor("#00ff00") 
        ] 
      });
    }
  }

  for (const menu of menus) {
    const canal = await client.channels.fetch(menu.id).catch(() => null);
    if (!canal) continue;

    const lastMessages = await canal.messages.fetch({ limit: 10 }).catch(() => new Map());
    const alreadyPosted = Array.from(lastMessages.values()).some(m => 
      m.author?.id === client.user.id && m.embeds?.some(e => e.title === menu.title)
    );
    if (alreadyPosted) continue;

    const embed = new EmbedBuilder()
      .setTitle(menu.title)
      .setDescription(menu.embedDesc)
      .setColor(menu.color || "#ff0000"); // Usa a cor do menus.js ou vermelho

    if (menu.embedImage) {
      embed.setThumbnail(menu.embedImage); // setThumbnail coloca a imagem pequena no canto
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("menu_ticket")
      .setPlaceholder("Escolhe uma opção")
      .addOptions(menu.options);

    await canal.send({ 
      embeds: [embed], 
      components: [new ActionRowBuilder().addComponents(selectMenu)] 
    });
  }
};
