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
            /* ================= MENU DE SELECÇÃO ================= */
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
                        "Aguarde pacientemente até receber seu produto ou uma response.\n\n" +
                        "*Atenciosamente, Jordan.*"
                    )
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar os Termos").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar os Termos").setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
            }

/* ================= BOTÃO RECUSAR ================= */
if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
    const tipoRec = cid.replace("recusar_termos_", "");
    const canalLogs = guild.channels.cache.get(config.STAFF_LOGS_CHANNEL_ID);

    if (canalLogs) {
        await canalLogs.send({
            content: `❌ @${user.username} **não aceitou** os termos para abrir ticket de: \`${tipoRec}\`   # 🔵 vpn-service`
        }).catch(() => {});
    }

    return interaction.update({
        content: "⚠️ Tens de aceitar os termos para abrir o teu ticket/pedido.",
        embeds: [],
        components: []
    });
}

/* ================= BOTÃO ACEITAR ================= */
if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
    const tipoAceito = cid.replace("aceitar_termos_", "");
    const canalLogs = guild.channels.cache.get(config.STAFF_LOGS_CHANNEL_ID);

    let tagFinal = "# ⭐ produto";

    const tipoLower = tipoAceito.toLowerCase();

    if (tipoLower.includes("steam")) {
        tagFinal = "# ⭐ steam-account";
    } else if (tipoLower.includes("vpn") || tipoLower.includes("cyberghost")) {
        tagFinal = "# 🔵 vpn-service";
    } else if (tipoLower.includes("spoofer") || tipoLower.includes("sp00fer")) {
        tagFinal = "# 🛡️ spoofer";
    } else if (tipoLower.includes("shark")) {
        tagFinal = "# 🦈 shark-menu";
    } else if (tipoLower.includes("stan")) {
        tagFinal = "# 🦍 stan-menu";
    } else if (tipoLower.includes("stellar")) {
        tagFinal = "# ⭐ stellar-menu";
    } else if (tipoLower.includes("lunax")) {
        tagFinal = "# 🌙 lunax-menu";
    } else if (tipoLower.includes("flyside")) {
        tagFinal = "# 🟣 flyside-menu";
    } else if (tipoLower.includes("discord")) {
        tagFinal = "# 💬 discord-account";
    } else if (tipoLower.includes("rockstar")) {
        tagFinal = "# 🎮 rockstar-account";
    } else if (tipoLower.includes("duck")) {
        tagFinal = "# 🦆 duck-cleaner";
    }

    if (canalLogs) {
        await canalLogs.send({
            content: `✅ @${user.username} **aceitou** os termos para abrir ticket de: \`${tipoAceito}\`   ${tagFinal}`
        }).catch(() => {});
    }

    // Continua com o menu de pagamento
    const menuPagamento = new StringSelectMenuBuilder()
        .setCustomId(`pagamento_${tipoAceito}`)
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
        content: "✅ **Termos aceites!** Agora seleciona o método de pagamento:",
        embeds: [],
        components: [new ActionRowBuilder().addComponents(menuPagamento)]
    });
}
            /* ================= CRIAR TICKET FINAL ================= */
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferReply({ flags: [64] });

                const tipoProd = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                const ticket = await guild.channels.create({
                    name: `ticket-${tipoProd}-${user.username}`.toLowerCase(),
                    type: ChannelType.GuildText,
                    parent: config.CATEGORY_ID || null,
                    topic: `${user.id}|${metodo}|${tipoProd}`, 
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { 
                            id: user.id, 
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] 
                        },
                        ...((config.STAFF_ROLES || []).map(r => ({
                            id: r,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                        })))
                    ]
                });

                const embedTicket = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`📦 **Produto:** ${tipoProd}\n🛡️ **Staff:** Aguardando...\n💳 **Método:** ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({
                    content: `<@${user.id}> obrigado(a) por criar um ticket, em breve algum staff te ajudara`,
                    embeds: [embedTicket],
                    components: [btns]
                });

                const rowGo = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Ir para o Ticket/Pedido")
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/channels/${guild.id}/${ticket.id}`)
                );

                return await interaction.editReply({ 
                    content: `✅ Ticket/Pedido criado com sucesso: <#${ticket.id}>`, 
                    components: [rowGo] 
                });
            }

            /* ================= CLAIM TICKET ================= */
            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas Staff.", flags: [64] });

                const [uid, met, pdr] = channel.topic?.split("|") || ["?", "Não definido", "Geral"];
                const emj = emojisPagamento[met] || "💰";

                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n**Produto:** ${pdr}\n**Método:** ${emj} ${met}`)
                    .setColor("#57f287");

                return await interaction.update({
                    embeds: [embedClaim],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("claimed").setLabel("Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                    )]
                });
            }

            /* ================= CHAMAR STAFF ================= */
            if (cid === "call_staff_list") {
                const tempoEspera = 300000;
                const agora = Date.now();

                if (cooldowns.has(user.id) && (agora < cooldowns.get(user.id) + tempoEspera)) {
                    const restante = Math.ceil(((cooldowns.get(user.id) + tempoEspera) - agora) / 60000);
                    return await interaction.reply({ 
                        content: `⚠️ Aguarda **${restante} minuto(s)** para poder chamar novamente!`, 
                        flags: [64] 
                    });
                }

                const members = await guild.members.fetch();
                const staffOnline = members
                    .filter(m => m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) && !m.user.bot)
                    .sort((a, b) => b.roles.highest.position - a.roles.highest.position || a.displayName.localeCompare(b.displayName));

                if (staffOnline.size === 0) return await interaction.reply({ content: "Sem Staff online.", flags: [64] });

                const opts = staffOnline.map(m => ({ label: m.displayName, value: m.id })).slice(0, 25);
                const menuS = new StringSelectMenuBuilder().setCustomId("notify_staff_id").setPlaceholder("Escolhe um Staff").addOptions(opts);

                return await interaction.reply({ content: "Quem pretendes chamar?", components: [new ActionRowBuilder().addComponents(menuS)], flags: [64] });
            }

            if (cid === "notify_staff_id") {
                const target = await guild.members.fetch(interaction.values[0]);
                cooldowns.set(user.id, Date.now());

                const embedDM = new EmbedBuilder()
                    .setTitle("📞 Chamada de Staff")
                    .setDescription(`O cliente **${user.username}** chamou-te em ${channel}`)
                    .setColor("#f1c40f");

                const rowL = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel("Ir para o Ticket").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
                );

                await target.send({ embeds: [embedDM], components: [rowL] }).catch(() => {});

                return await interaction.update({ 
                    content: `📢 <@${target.id}>, foste solicitado aqui por **${user.username}**!`, 
                    components: [] 
                });
            }

            /* ================= FECHAR TICKET ================= */
            if (cid === "close_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas staff pode fechar.", flags: [64] });

                const messages = await channel.messages.fetch({ limit: 50 });
                const msgCount = messages.size; 

                if (msgCount >= 5) {
                    await interaction.reply(`🔒 Ticket com mensagens suficientes (**${msgCount}**). A gerar transcrição...`);
                    await sendTranscript(channel, user.tag); 
                    return setTimeout(() => channel.delete().catch(() => {}), 5000);
                } else {
                    const embedAviso = new EmbedBuilder()
                        .setTitle("⚠️ Poucas Mensagens")
                        .setDescription(`Este ticket tem apenas **${msgCount}** mensagens.\nQueres guardar a transcrição ou apenas fechar?`)
                        .setColor("#f1c40f");

                    const rowEscolha = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("confirm_close_save").setLabel("Guardar e Fechar").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("confirm_close_silent").setLabel("Fechar sem Guardar").setStyle(ButtonStyle.Danger)
                    );

                    return await interaction.reply({ embeds: [embedAviso], components: [rowEscolha], flags: [64] });
                }
            }

            if (cid === "confirm_close_save") {
                await interaction.update({ content: "🔒 A guardar log e a eliminar...", embeds: [], components: [] });
                await sendTranscript(channel, user.tag);
                return setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

            if (cid === "confirm_close_silent") {
                await interaction.update({ content: "❌ Ticket eliminado sem registo.", embeds: [], components: [] });
                return setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) { 
            console.error("❌ Erro Geral no InteractionCreate:", err); 
        }
    });
};
