const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, MessageFlags 
} = require("discord.js");

const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");
const isStaff = require("../helpers/isStaff");

const cooldowns = new Map();

const emojisPagamento = {
    "MBWay": "<:mbway:1464608251516813446>",
    "PayPal": "<:paypal:1464608396383883314>",
    "Revolut": "<:revolut:1464608485617565726>",
    "CartaoCredito": "<:creditcard:1464608966826004676>",
    "GooglePay": "<:googlepay:1464609044315508797>",
    "ApplePay": "<:applepay:1464609102906003588>",
    "ReferenciaMultibanco": "<:multibanco:1464609317926735902>"
};

module.exports = (client) => {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction) return;
        const { guild, channel, user, member, customId: cid } = interaction;
        if (!guild) return;

        try {
            // 1. MENU INICIAL -> TERMOS
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];
                const embedTermos = new EmbedBuilder()
                    .setTitle("⚖️ Termos de Serviço - Jordan Shop")
                    .setDescription("**Concordas com os termos da loja?**\n\n- Sem reembolsos.\n- Substituição apenas com voucher.\n- Suporte apenas em PT.")
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                
                return await interaction.reply({ embeds: [embedTermos], components: [row], flags: [64] }).catch(() => {});
            }

            // 2. RECUSAR TERMOS
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipo = cid.replace("recusar_termos_", "");
                
                // Log Silencioso (se falhar, não crasha)
                const logChan = guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChan && logChan.send) {
                    logChan.send(`❌ <@${user.id}> recusou termos para \`${tipo}\`.`).catch(() => {});
                }

                return await interaction.update({ content: "⚠️ Aceita os termos para continuar.", embeds: [], components: [] });
            }

            // 3. ACEITAR TERMOS -> PAGAMENTO
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");

                const logChan = guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChan && logChan.send) {
                    logChan.send(`✅ <@${user.id}> aceitou termos para \`${tipo}\`.`).catch(() => {});
                }

                const menuPag = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("Método de Pagamento")
                    .addOptions([
                        { label: "MBWay", value: "MBWay", emoji: "1464608251516813446" },
                        { label: "PayPal", value: "PayPal", emoji: "1464608396383883314" },
                        { label: "Revolut", value: "Revolut", emoji: "1464608485617565726" }
                    ]);

                return await interaction.update({ 
                    content: "💳 Escolhe o pagamento:", 
                    embeds: [], 
                    components: [new ActionRowBuilder().addComponents(menuPag)] 
                });
            }

            // 4. CRIAR TICKET
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                // Criar canal primeiro, depois responder
                const catId = config.CATEGORY_ID;
                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    parent: catId || null,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                const embedMsg = new EmbedBuilder()
                    .setTitle("Jordan Shop | Ticket")
                    .setDescription(`Método: ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ content: `<@${user.id}>`, embeds: [embedMsg], components: [btns] });

                // Aqui usamos o update para não dar erro de "already acknowledged"
                return await interaction.update({ content: `✅ Ticket criado: ${ticket}`, components: [], embeds: [] });
            }

            // 5. FECHAR TICKET
            if (cid === "close_ticket") {
                await interaction.reply("🔒 A fechar...");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) { 
            console.error("❌ Erro detetado:", err.message);
        }
    });
};
