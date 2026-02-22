const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const menus = require("../menus");
const { LOG_CHANNEL_ID } = process.env;

module.exports = async (client) => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  // Atividade do Bot
  client.user.setPresence({ 
    activities: [{ name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: 0 }], 
    status: "online" 
  });

  // Log de Inicialização
  if (LOG_CHANNEL_ID) {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({ 
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Bot Iniciado")
            .setDescription("O sistema de menus foi recarregado.")
            .setColor("#00ff00") 
        ] 
      });
    }
  }

  // Loop por todos os menus definidos no menus.js
  for (const menu of menus) {
    try {
      const canal = await client.channels.fetch(menu.id).catch(() => null);
      
      if (!canal) {
        console.error(`❌ Canal não encontrado para o menu: ${menu.title} (ID: ${menu.id})`);
        continue;
      }

      // Procura se o bot já postou este menu específico nas últimas 20 mensagens
      const lastMessages = await canal.messages.fetch({ limit: 20 }).catch(() => new Map());
      const alreadyPosted = Array.from(lastMessages.values()).some(m => 
        m.author?.id === client.user.id && 
        m.embeds?.some(e => e.title === menu.title)
      );

      // Se já existir, ele pula para o próximo para não inundar o canal
      if (alreadyPosted) {
        console.log(`⏭️ Menu "${menu.title}" já existe no canal. Ignorado.`);
        continue;
      }

      // Construção do Embed
      const embed = new EmbedBuilder()
        .setTitle(menu.title)
        .setDescription(menu.embedDesc)
        .setColor(menu.color || "#ff0000");

      // Define a imagem (Thumbnail para ficar no canto como na tua foto)
      if (menu.embedImage) {
        embed.setThumbnail(menu.embedImage);
      }

      // Cria o Menu de Seleção
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("menu_ticket")
        .setPlaceholder("Escolhe uma opção")
        .addOptions(menu.options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      // Envio Final
      await canal.send({ embeds: [embed], components: [row] });
      console.log(`✅ Menu enviado: ${menu.title}`);

    } catch (error) {
      console.error(`❌ Erro ao processar o menu ${menu.title}:`, error);
    }
  }
};
