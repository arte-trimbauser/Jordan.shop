// src/events/publicarMenus.js
// Verifica se cada menu já existe no canal. Se sim, salta. Se não, envia.
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getMenus } = require("../menus-db");

module.exports = async (client) => {
    let enviados = 0;
    let jaExistentes = 0;
    let erros = 0;

    // ⭐ LÊ DO SUPABASE (não do menus.js hardcoded)
    const menus = await getMenus();
    console.log(`📤 A verificar ${menus.length} menus (origem: Supabase)...`);

    for (const menu of menus) {
        try {
            const canal = await client.channels.fetch(menu.id).catch(() => null);

            if (!canal) {
                console.log(`⚠️ Canal ${menu.id} não encontrado (menu: "${menu.title}")`);
                erros++;
                continue;
            }

            if (!canal.isTextBased || !canal.isTextBased()) {
                console.log(`⚠️ Canal ${menu.id} não é de texto`);
                erros++;
                continue;
            }

            // ===== VERIFICA SE JÁ EXISTE =====
            const msgs = await canal.messages.fetch({ limit: 30 }).catch(() => null);
            const jaExiste = msgs && msgs.some(m =>
                m.author.id === client.user.id &&
                m.embeds[0]?.title === menu.title
            );

            if (jaExiste) {
                console.log(`ℹ️ Menu "${menu.title}" já existe em #${canal.name} — ignorado.`);
                jaExistentes++;
                continue;
            }

            // ===== NÃO EXISTE → ENVIA =====
            const embed = new EmbedBuilder()
                .setTitle(menu.title)
                .setDescription(menu.embedDesc || "Sem descrição")
                .setColor(menu.color || "#8b0000");

            if (menu.embedImage && menu.embedImage.startsWith("http")) {
                embed.setImage(menu.embedImage);
            }
            if (menu.embedThumbnail && menu.embedThumbnail.startsWith("http")) {
                embed.setThumbnail(menu.embedThumbnail);
            }

            const components = [];
            if (menu.options?.length) {
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
                components.push(new ActionRowBuilder().addComponents(select));
            }

            await canal.send({ embeds: [embed], components });
            console.log(`✅ Menu "${menu.title}" enviado em #${canal.name}`);
            enviados++;

            await new Promise(r => setTimeout(r, 1200));
        } catch (err) {
            console.error(`❌ Erro com "${menu.title}":`, err.message);
            erros++;
        }
    }

    console.log(`📊 Menus — enviados: ${enviados} | já existiam: ${jaExistentes} | erros: ${erros}`);
};
