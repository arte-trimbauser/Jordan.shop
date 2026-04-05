const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("carrinho")
        .setDescription("Mostra o teu carrinho de compras"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const carrinho = interaction.client.carrinhos?.get(userId) || [];

        if (carrinho.length === 0) {
            return interaction.reply({
                content: "🛒 O teu carrinho está vazio!\n\nUsa `/adicionar` para adicionar produtos.",
                ephemeral: true
            });
        }

        let descricao = "";
        let total = 0;

        carrinho.forEach((item, index) => {
            // Pega o preço da primeira opção (podes melhorar depois)
            const precoBase = item.options[0]?.description ? 
                parseFloat(item.options[0].description.match(/\d+([.,]\d+)?/)?.[0].replace(',', '.') || 0) : 0;

            const subtotal = precoBase * item.quantidade;
            total += subtotal;

            descricao += `• **${item.titulo}**\n`;
            descricao += `  Quantidade: **${item.quantidade}**\n`;
            descricao += `  Preço unitário: €${precoBase.toFixed(2)}\n`;
            descricao += `  Subtotal: €${subtotal.toFixed(2)}\n\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle("🛒 Teu Carrinho - Jordan Shop")
            .setDescription(descricao || "Carrinho vazio")
            .addFields({ name: "Total Aproximado", value: `**€${total.toFixed(2)}**`, inline: true })
            .setColor("#8b0000")
            .setFooter({ text: "Podes editar a quantidade ou finalizar o pedido" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("finalizar_carrinho")
                .setLabel("✅ Finalizar Compra")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("limpar_carrinho")
                .setLabel("🗑️ Limpar Carrinho")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};
