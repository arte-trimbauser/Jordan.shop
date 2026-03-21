const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, ChannelType 
} = require("discord.js");

const config = require("../config");
const isStaff = require("../helpers/isStaff");
const sendTranscript = require("../helpers/sendTranscript"); // Certifica-te que este helper usa o Supabase

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
            // 1. MENU DO SITE OU DO BOT (Intercalado)
            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid === "menu_produtos")) {
                const tipo = interaction.values[0];

                const embed = new EmbedBuilder()
                .setTitle("⚖️ Termos de Serviço - Jordan Shop")
                .setDescription(
            "**Termos de Serviço de Reembolso**\n" +
            "Não oferecemos reembolsos após a conclusão de uma compra ou serviço. Em casos excepcionais, uma substituição pode ser oferecida, se possível.\n\n" +
            "**Termos de Serviço de Substituição**\n" +
            "A substituição só é possível com um voucher.\n" +
            "Sem voucher = sem garantia ou substituição.\n\n" +
            "**Termos de Serviço da Conta**\n" +
            "Após receber uma conta, você deverá alterar seu endereço de e-mail e senha imediatamente.\n" +
            "Não assumimos qualquer responsabilidade ou substituição caso você não o faça.\n\n" +
            "**Termos de Serviço do PayPal**\n" +
            "Os pagamentos devem ser enviados via \"Amigos e Familiares\" – sem uma mensagem nos detalhes de pagamento.\n" +
            "Não nos responsabilizamos se nossa conta do PayPal for bloqueada e os fundos permanecerem lá. Não há reembolsos possíveis!\n\n" +
            "**Idioma do Ticket**\n" +
            "O suporte e os tickets são processados exclusivamente em Português.\n\n" +
            "**Comportamento do Ticket**\n" +
            "Por favor, não envie spam ou ping várias vezes em DM ou tickets.\n" +
            "Aguarde pacientemente até receber seu produto ou uma resposta.\n\n" +
            "*Atenciosamente, Jordan.*"
          )
          .setColor("#ff0000");


                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
            }

            // 2. LOG DE RECUSAR TERMOS
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipo = cid.replace("recusar_termos_", "");
                const logChan = await guild.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
                
                if (logChan) {
                    await logChan.send(`❌ <@${user.id}> não aceitou os termos para a opção **${tipo}**.`);
                }

                return interaction.update({ content: "⚠️ Tens de aceitar para abrir ticket.", embeds: [], components: [] });
            }

            // 3. LOG DE ACEITAR E ESCOLHER PAGAMENTO
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
                        emoji: emojisPagamento[m].match(/\d+/) ? emojisPagamento[m].match(/\d+/)[0] : null
                    })));

                return interaction.update({
                    content: "💳 **Termos aceites!** Escolhe o pagamento:",
                    embeds: [],
                    components: [new ActionRowBuilder().addComponents(menu)]
                });
            }

            // 4. CRIAR TICKET (Vindo do menu de pagamento)
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferUpdate();
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: config.CATEGORY_ID,
                    topic: `${user.id}|${metodo}|${tipo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                        ...config.STAFF_ROLES.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const embedTicket = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`📦 **Produto:** ${tipo}\n🛡️ **Staff:** Aguardando...\n💳 **Método:** ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ content: `<@${user.id}> ticket aberto para **${tipo}**!`, embeds: [embedTicket], components: [btns] });
                
                return interaction.editReply({ 
                    content: `✅ Ticket/Pedido criado: <#${ticket.id}>`, 
                    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Ir para o Ticket").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${ticket.id}`))]
                });
            }

            // 5. CLAIM TICKET
            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas staff.", flags: [64] });
                const [uid, met, pdr] = channel.topic?.split("|") || ["?", "?", "?"];
                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n📦 **Produto:** ${pdr}\n💳 **Pagamento:** ${met}`)
                    .setColor("#57f287");

                return interaction.update({ embeds: [embedClaim], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger))] });
            }

            // 6. FECHAR TICKET COM REGRAS DE MENSAGENS (Supabase + Transcripts)
            if (cid === "close_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas staff.", flags: [64] });
                
                const messages = await channel.messages.fetch({ limit: 50 });
                const msgCount = messages.size;

                if (msgCount >= 5) {
                    await interaction.reply("📂 **A guardar transcript e a fechar...**");
                    await sendTranscript(channel, user.tag);
                    setTimeout(() => channel.delete().catch(() => {}), 5000);
                } else {
                    const embedAviso = new EmbedBuilder()
                        .setTitle("⚠️ Poucas Mensagens")
                        .setDescription(`Este ticket só tem **${msgCount}** mensagens. Queres guardar o log mesmo assim?`)
                        .setColor("#f1c40f");

                    const rowAviso = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("confirm_close_save").setLabel("Guardar Log").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("confirm_close_silent").setLabel("Fechar Sem Log").setStyle(ButtonStyle.Danger)
                    );

                    return interaction.reply({ embeds: [embedAviso], components: [rowAviso], flags: [64] });
                }
            }

            // CONFIRMAÇÕES DE FECHO
            if (cid === "confirm_close_save") {
                await interaction.update({ content: "📂 A guardar log...", components: [] });
                await sendTranscript(channel, user.tag);
                setTimeout(() => channel.delete().catch(() => {}), 4000);
            }

            if (cid === "confirm_close_silent") {
                await interaction.update({ content: "❌ A fechar silenciosamente...", components: [] });
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) {
            console.error("Erro na Interaction:", err);
        }
    });
};
