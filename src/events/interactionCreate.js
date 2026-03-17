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
        const { guild, channel, user, member } = interaction;
        const cid = interaction.customId;
        if (!guild) return;

        try {
            // 1. MENU INICIAL -> TERMOS (TEU TEXTO ORIGINAL)
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];
                const embedTermos = new EmbedBuilder()
                    .setTitle("⚖️ Termos de Serviço - Jordan Shop")
                    .setDescription(
                        "**Termos de Serviço de Reembolso**\n" +
                        "Não oferecemos reembolsos após a conclusão de uma compra ou serviço.\n\n" +
                        "**Termos de Serviço de Substituição**\n" +
                        "A substituição só é possível com um voucher.\n\n" +
                        "**Termos de Serviço da Conta**\n" +
                        "Deverás alterar o e-mail e palavra-passe imediatamente após receberes a conta.\n\n" +
                        "**Idioma do Ticket**\n" +
                        "O suporte é processado exclusivamente em Português.\n\n" +
                        "Ao clicares em **Aceitar**, concordas com todas as nossas regras.\n\n" +
                        "*Atenciosamente, Jordan.*"
                    )
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                
                return interaction.reply({ embeds: [embedTermos], components: [row], flags: [64] });
            }

            // 2. RECUSAR TERMOS
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipo = cid.replace("recusar_termos_", "");
                
                const logChanGeral = guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChanGeral && logChanGeral.send) {
                    logChanGeral.send(`❌ <@${user.id}> não aceitou os termos para o canal \`${tipo}\`.`).catch(() => {});
                }

                return interaction.update({ 
                    content: "⚠️ **Tens que aceitar os termos para abrir o ticket.**", 
                    embeds: [], 
                    components: [] 
                });
            }

            // 3. ACEITAR TERMOS -> PAGAMENTO (TEUS MÉTODOS ORIGINAIS)
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");

                const logChanGeral = guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChanGeral && logChanGeral.send) {
                    logChanGeral.send(`✅ <@${user.id}> aceitou os termos para o canal \`${tipo}\`.`).catch(() => {});
                }

                const menuPag = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("Seleciona o método de pagamento...")
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
                    content: "💳 **Termos aceites!** Escolhe o método de pagamento para abrir o ticket:", 
                    embeds: [], 
                    components: [new ActionRowBuilder().addComponents(menuPag)] 
                });
            }

            // 4. CRIAR TICKET
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                const cat = guild.channels.cache.get(config.CATEGORY_ID);
                
                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    parent: cat ? cat.id : null,
                    topic: `${user.id}|${metodo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const embedMsg = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`🛡️ **Staff:** Aguardando...\n**Método:** ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ 
                    content: `<@${user.id}> obrigado(a) por criar um ticket, em breve algum staff te ajudará.`, 
                    embeds: [embedMsg], 
                    components: [btns] 
                });

                return interaction.update({ content: `✅ Ticket criado: ${ticket}`, components: [], embeds: [] });
            }

            // 5. REIVINDICAR TICKET
            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Staff apenas.", flags: [64] });
                const [uid, met] = channel.topic?.split("|") || ["?", "Não definido"];
                const emj = emojisPagamento[met] || "💰";

                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n**Método:** ${emj} ${met}`)
                    .setColor("#57f287");

                return interaction.update({
                    embeds: [embedClaim],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("claimed").setLabel("Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                    )]
                });
            }

            // 6. FECHAR TICKET
            if (cid === "close_ticket") {
                if (!isStaff(member)) return;
                await interaction.reply("🔒 A fechar...");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) { 
            console.error("❌ Erro:", err.message); 
        }
    });
};
