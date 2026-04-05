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
            // Tenta pegar o preço da primeira opção
            let precoUnit = 0;
            if (item.options && item.options.length > 0) {
                const desc = item.options[0].description || "";
                const match = desc.match(/\d+([.,]\d+)?/);
                if (match) precoUnit = parseFloat(match[0].replace(',', '.'));
            }

            const subtotal = precoUnit * (item.quantidade || 1);
            total += subtotal;

            descricao += `**${index + 1}.** ${item.titulo}\n`;
            descricao += `   Quantidade: **${item.quantidade || 1}**\n`;
            descricao += `   Preço unitário: €${precoUnit.toFixed(2)}\n`;
            descricao += `   Subtotal: €${subtotal.toFixed(2)}\n\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle("🛒 Teu Carrinho - Jordan Shop")
            .setDescription(descricao)
            .addFields(
                { name: "Total Aproximado", value: `**€${total.toFixed(2)}**`, inline: true },
                { name: "Itens no carrinho", value: `${carrinho.length}`, inline: true }
            )
            .setColor("#8b0000")
            .setFooter({ text: "Podes adicionar mais com /adicionar" });

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

        await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            ephemeral: true 
        });
    }
};
