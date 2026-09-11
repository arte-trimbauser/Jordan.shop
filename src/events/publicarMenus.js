// src/events/publicarMenus.js
// Publica cada menu do menus.js no canal cujo ID corresponde ao menu.id
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const menus = require("../menus");

module.exports = async (client) => {
    let publicados = 0;
    let jaExistentes = 0;
    let erros = 0;

    console.log(`📤 A publicar ${menus.length} menus...`);

    for (const menu of menus) {
        try {
            // 1. Tenta obter o canal pelo ID do menu
            const canal = await client.channels.fetch(menu.id).catch(() => null);

            if (!canal) {
                console.log(`⚠️ Canal ${menu.id} não encontrado ou bot sem acesso (menu: "${menu.title}")`);
                erros++;
                continue;
            }

            if (!canal.isTextBased || !canal.isTextBased()) {
                console.log(`⚠️ Canal ${menu.id} não é de texto (menu: "${menu.title}")`);
                erros++;
                continue;
            }

            // 2. Verifica se já existe o embed deste menu (evita duplicados em restart)
            const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => null);
            if (msgs) {
                const jaExiste = msgs.some(m =>
                    m.author.id === client.user.id &&
                    Array.isArray(m.embeds) &&
                    m.embeds[0]?.title === menu.title
                );
                if (jaExiste) {
                    console.log(`ℹ️ Menu "${menu.title}" já existe em #${canal.name} — ignorado.`);
                    jaExistentes++;
                    continue;
                }
            }

            // 3. Constrói o embed
            const embed = new EmbedBuilder()
                .setTitle(menu.title)
                .setDescription(menu.embedDesc || "Sem descrição")
                .setColor(menu.color || "#8b0000");

            if (menu.embedImage && menu.embedImage.startsWith("http")) {
                embed.setImage(menu.embedImage);
            }

            // 4. Constrói o select menu com as opções do produto
            if (!menu.options || menu.options.length === 0) {
                console.log(`⚠️ Menu "${menu.title}" não tem opções — enviado apenas o embed.`);
                await canal.send({ embeds: [embed] });
                publicados++;
                await new Promise(r => setTimeout(r, 1200));
                continue;
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId("menu_produtos")
                .setPlaceholder("Escolhe uma opção")
                .addOptions(
                    menu.options.slice(0, 25).map(o => ({
                        label: (o.label || "Opção").slice(0, 100),
                        description: (o.description || "Ver opções").slice(0, 100),
                        value: o.value || String(Math.random())
                    }))
                );

            const row = new ActionRowBuilder().addComponents(select);

            // 5. Envia
            await canal.send({ embeds: [embed], components: [row] });

            console.log(`✅ Menu "${menu.title}" publicado em #${canal.name}`);
            publicados++;

            // Delay para não rebentar com rate limit
            await new Promise(r => setTimeout(r, 1200));

        } catch (err) {
            console.error(`❌ Erro ao publicar "${menu.title}":`, err.message);
            erros++;
        }
    }

    console.log(`📊 Menus — publicados: ${publicados} | já existiam: ${jaExistentes} | erros: ${erros}`);
};
