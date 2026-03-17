const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder 
} = require("discord.js");

const config = require("../config");
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

            // 1. MENU -> TERMOS
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];

                const embed = new EmbedBuilder()
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

                return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
            }

            // 2. RECUSAR
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipo = cid.replace("recusar_termos_", "");

                const logChan = await guild.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
                if (logChan) {
                    await logChan.send(`❌ <@${user.id}> não aceitou os termos para a opção **${tipo}**.`);
                }

                return interaction.update({
                    content: "⚠️ **Tens que aceitar os termos para abrir o ticket.**",
                    embeds: [],
                    components: []
                });
            }

            // 3. ACEITAR
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");

                const logChan = await guild.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
                if (logChan) {
                    await logChan.send(`✅ <@${user.id}> aceitou os termos para a opção **${tipo}**.`);
                }

                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("Seleciona o método de pagamento...")
                    .addOptions(Object.keys(emojisPagamento).map(m => ({
                        label: m,
                        value: m,
                        emoji: emojisPagamento[m].match(/\d+/)[0]
                    })));

                return interaction.update({
                    content: "💳 **Termos aceites!** Escolhe o método de pagamento:",
                    embeds: [],
                    components: [new ActionRowBuilder().addComponents(menu)]
                });
            }

            // 4. CRIAR TICKET
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferUpdate();

                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    parent: config.CATEGORY_ID,
                    topic: `${user.id}|${metodo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(r => ({
                            id: r,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                        }))
                    ]
                });

                const embed = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`🛡️ **Staff:** Aguardando...\n💳 Método: ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({
                    content: `<@${user.id}>\n\nObrigado(a) por criar um ticket, em breve algum staff te ajudará.\n\n🛡️ Ticket Reivindicado\n👤 Staff: Aguardando...\n💳 Método: ${emoji} ${metodo}`,
                    embeds: [embed],
                    components: [btns]
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Ir para o Ticket")
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/channels/${guild.id}/${ticket.id}`)
                );

                return interaction.editReply({
                    content: `✅ Ticket criado: ${ticket}`,
                    components: [row]
                });
            }

            // 5. CLAIM
            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas Staff.", flags: [64] });

                const [uid, met] = channel.topic?.split("|") || ["?", "?"];
                const emoji = emojisPagamento[met] || "💰";

                const embed = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 Staff: <@${user.id}>\n💳 Método: ${emoji} ${met}`)
                    .setColor("#57f287");

                return interaction.update({
                    embeds: [embed],
                    components: []
                });
            }

            // 6. CHAMAR STAFF
            if (cid === "call_staff_list") {
                const members = await guild.members.fetch();

                const staff = members
                    .filter(m => m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) && !m.user.bot)
                    .sort((a, b) => {
                        const posA = a.roles.highest.position;
                        const posB = b.roles.highest.position;
                        if (posB !== posA) return posB - posA;
                        return a.displayName.localeCompare(b.displayName);
                    });

                const opts = staff.map(m => ({
                    label: m.displayName,
                    value: m.id
                })).slice(0, 25);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("notify_staff_id")
                    .setPlaceholder("Escolhe o staff...")
                    .addOptions(opts);

                return interaction.reply({
                    content: "Seleciona o staff:",
                    components: [new ActionRowBuilder().addComponents(menu)],
                    flags: [64]
                });
            }

            if (cid === "notify_staff_id") {
                const target = await guild.members.fetch(interaction.values[0]);

                await target.send(`📞 Foste chamado por ${user} no ticket ${channel}`).catch(() => {});
                await channel.send(`📢 <@${target.id}> foi chamado!`);

                return interaction.update({ content: "✅ Staff chamado.", components: [] });
            }

            // 7. FECHAR
            if (cid === "close_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas staff.", flags: [64] });

                const messages = await channel.messages.fetch({ limit: 10 });
                const count = messages.size;

                const sendTranscript = require("../helpers/sendTranscript");

                if (count >= 5) {
                    await interaction.reply("📂 A gerar transcript e fechar...");
                    await sendTranscript(channel, user.tag);
                    return setTimeout(() => channel.delete().catch(() => {}), 4000);
                } else {
                    const embed = new EmbedBuilder()
                        .setTitle("⚠️ Poucas mensagens")
                        .setDescription(`Este ticket tem apenas **${count}** mensagens.\nQueres guardar?`)
                        .setColor("#f1c40f");

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("confirm_close_save").setLabel("Guardar").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("confirm_close_silent").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                    );

                    return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
                }
            }

            if (cid === "confirm_close_save") {
                const sendTranscript = require("../helpers/sendTranscript");
                await interaction.update({ content: "📂 A guardar...", components: [] });
                await sendTranscript(channel, user.tag);
                return setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

            if (cid === "confirm_close_silent") {
                await interaction.update({ content: "❌ Fechado sem guardar.", components: [] });
                return setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) {
            console.error(err);
        }
    });
};
