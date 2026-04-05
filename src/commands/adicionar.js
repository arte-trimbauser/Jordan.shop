const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const menus = require("../menus");   // ← aqui vamos usar o teu ficheiro menus.js

module.exports = {
    data: new SlashCommandBuilder()
        .setName("adicionar")
        .setDescription("Adiciona um produto ao teu carrinho"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("🛒 Adicionar ao Carrinho - Jordan Shop")
            .setDescription("Escolhe o produto que queres adicionar:")
            .setColor("#8b0000");

        const select = new StringSelectMenuBuilder()
            .setCustomId("adicionar_produto")
            .setPlaceholder("Seleciona um produto")
            .addOptions(menus.map(menu => ({
                label: menu.title.replace(/[\*\uD83D\uDE00-\uD83D\uDE4F\uD83D\uDE80-\uD83D\uDEF6]/g, '').trim(), // limpa emojis
                description: menu.options[0]?.description || "Ver opções",
                value: menu.id
            })));

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};
