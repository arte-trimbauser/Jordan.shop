const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, ChannelType 
} = require("discord.js");

const config = require("../config");
const isStaff = require("../helpers/isStaff");
const sendTranscript = require("../helpers/sendTranscript");

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
        if (!interaction.guild) return;

        const { guild, channel, user, member, customId: cid } = interaction;

        try {
            /* ================= MENU INICIAL ================= */
            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid === "menu_produtos")) {
                const tipo = interaction.values[0];

                const embed = new EmbedBuilder()
                    .setTitle("⚖️ Termos de Serviço - Jordan Shop")
                    .setDescription("**Lê os termos com atenção.**\n\nAo abrir um ticket, concordas com as nossas regras de reembolso e substituição.\n\n*Atenciosamente, Jordan.*")
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
            }

            /* ================= RECUSAR ================= */
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const canalLogs = guild.channels.cache.get(config.STAFF_LOGS_CHANNEL_ID);
                if (canalLogs) {
                    canalLogs.send({ content: `❌ **${user.tag}** recusou os termos.` });
                }
                return interaction.update({ content: "⚠️ Tens de aceitar para continuar.", embeds: [], components: [] });
            }

            /* ================= ACEITAR ================= */
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");
                const canalLogs = guild.channels.cache.get(config.STAFF_LOGS_CHANNEL_ID);
                if (canalLogs) {
                    canalLogs.send({ content: `✅ **${user.tag}** aceitou os termos para: \`${tipo}\`` });
                }

                const menuPag = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("💳 Escolha o método de pagamento")
                    .addOptions([
                        { label: "MBWay", value: "MBWay", emoji: "1464608251516813446" },
                        { label: "PayPal", value: "PayPal", emoji: "1464608396383883314" },
                        { label: "Revolut", value: "Revolut", emoji: "1464608485617565726" },
                        { label: "Cartão de Crédito", value: "CartaoCredito", emoji: "1464608966826004676" },
                        { label: "Google Pay", value: "GooglePay", emoji: "1464609044315508797" },
                        { label: "Apple Pay", value: "ApplePay", emoji: "1464609102906003588" },
                        { label: "Multibanco", value: "ReferenciaMultibanco", emoji: "1464609317926735902" }
                    ]);

                return interaction.update({
                    content: "💳 **Seleciona o método de pagamento:**",
                    embeds: [],
                    components: [new ActionRowBuilder().addComponents(menuPag)]
                });
            }

            /* ================= CRIAR TICKET ================= */
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferReply({ flags: [64] });
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`.toLowerCase(),
                    type: ChannelType.GuildText,
                    parent: config.CATEGORY_ID || null,
                    topic: `${user.id}|${metodo}|${tipo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                        ...((config.STAFF_ROLES || []).map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] })))
                    ]
                });

                const embedTicket = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`📦 **Produto:** ${tipo}\n💳 **Método:** ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ content: `<@${user.id}> o teu ticket foi aberto!`, embeds: [embedTicket], components: [btns] });
                return interaction.editReply({ content: `✅ Ticket criado: <#${ticket.id}>` });
            }

            /* ================= CLAIM E FECHAR ================= */
            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas Staff.", flags: [64] });
                return interaction.update({ content: `🛡️ Reivindicado por <@${user.id}>`, components: [] });
            }

            if (cid === "close_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas Staff.", flags: [64] });
                await interaction.reply("🔒 A fechar...");
                return setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) {
            console.error("❌ Erro:", err);
        }
    });
};
