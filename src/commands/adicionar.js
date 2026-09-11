// src/commands/adicionar.js
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");
const menus = require("../menus");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("adicionar")
        .setDescription("Adiciona um produto ao teu carrinho"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("🛒 Adicionar ao Carrinho - Jordan Shop")
            .setDescription("Escolhe o produto que queres adicionar:")
            .setColor("#8b0000");

        // Limpa emojis usando propriedade Unicode (mais seguro que o regex antigo)
        const selectOptions = menus.map(menu => {
            let nomeLimpo = (menu.title || "")
                .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, "")
                .replace(/\s+/g, " ")
                .trim();

            if (!nomeLimpo) nomeLimpo = "Produto";
            if (nomeLimpo.length > 100) nomeLimpo = nomeLimpo.slice(0, 97) + "...";

            let descricao = (menu.options?.[0]?.description || "Ver opções")
                .replace(/[\p{Extended_Pictographic}]/gu, "")
                .replace(/\s+/g, " ")
                .trim();
            if (!descricao) descricao = "Ver opções";
            if (descricao.length > 100) descricao = descricao.slice(0, 97) + "...";

            return {
                label: nomeLimpo,
                description: descricao,
                value: menu.id
            };
        });

        // Validação: values duplicados quebram o addOptions inteiro
        const valores = new Set();
        for (const opt of selectOptions) {
            if (valores.has(opt.value)) {
                console.error(`❌ Value duplicado em menus.js: ${opt.value}`);
                return interaction.reply({
                    content: "❌ Erro interno: IDs duplicados nos menus. Contacta um admin.",
                    flags: 64
                });
            }
            valores.add(opt.value);
        }

        if (selectOptions.length === 0) {
            return interaction.reply({
                content: "❌ Nenhum produto configurado em `menus.js`.",
                flags: 64
            });
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId("adicionar_produto")
            .setPlaceholder("Seleciona um produto")
            .addOptions(selectOptions.slice(0, 25)); // Discord aceita máx. 25

        const row = new ActionRowBuilder().addComponents(select);

        try {
            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: 64
            });
        } catch (err) {
            console.error("❌ Erro ao enviar /adicionar:", err);
            console.error("Options enviadas:", JSON.stringify(selectOptions, null, 2));
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Erro ao mostrar produtos. Verifica os logs.",
                    flags: 64
                }).catch(() => {});
            }
        }
    }
};
