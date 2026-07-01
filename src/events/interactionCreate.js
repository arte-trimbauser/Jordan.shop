// src/events/interactionCreate.js
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionsBitField, StringSelectMenuBuilder, ChannelType
} = require("discord.js");
const config = require("../config");
const isStaff = require("../helpers/isStaff");
const sendTranscript = require("../helpers/sendTranscript");
const menus = require("../menus");
const cooldowns = new Map();
const { handleChamarCommand, handleFecharTicketSaida } = require("../commands/chamarCommand");
const { handleSistemaInteraction } = require("./sistemaCompleto");
const { handleVerificacaoInteraction } = require("./sistemaVerificacao");

const emojisPagamento = {
    "MBWay": "<:mbway:1464608251516813446>",
    "PayPal": "<:paypal:1464608396383883314>",
    "Revolut": "<:revolut:1464608485617565726>",
    "CartaoCredito": "<:creditcard:1464608966826004676>",
    "GooglePay": "<:googlepay:1464609044315508797>",
    "ApplePay": "<:applepay:1464609102906003588>",
    "ReferenciaMultibanco": "<:multibanco:1464609317926735902>"
};

// ========== ANTI-DUPLICADOS PARA LOGS DE TICKET ==========
const recentTicketLogs = new Map();
const LOG_COOLDOWN_MS = 5000;

function isDuplicateTicketLog(userId, action, channelId) {
    const key = `${userId}-${action}-${channelId}`;
    const now = Date.now();
    const lastSent = recentTicketLogs.get(key);
    if (lastSent && (now - lastSent) < LOG_COOLDOWN_MS) {
        return true;
    }
    recentTicketLogs.set(key, now);
    if (recentTicketLogs.size > 1000) {
        const cutoff = now - 600000;
        for (const [k, v] of recentTicketLogs) {
            if (v < cutoff) recentTicketLogs.delete(k);
        }
    }
    return false;
}

module.exports = (client) => {
    if (!client.carrinhos) client.carrinhos = new Map();

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.guild) return;

        const processadoPeloSistema = await handleSistemaInteraction(interaction, client);
        if (processadoPeloSistema) return;

        const processadoPeloSistemaVerificacao = await handleVerificacaoInteraction(interaction, client);
        if (processadoPeloSistemaVerificacao) return;

        const { guild, channel, user, member, customId: cid } = interaction;

        try {

            if (interaction.isChatInputCommand()) {
                if (interaction.commandName === "chamar") {
                    return await handleChamarCommand(interaction, client);
                }
                if (interaction.commandName === "adicionar") {
                    const embed = new EmbedBuilder()
                        .setTitle("🛒 Adicionar ao Carrinho - Jordan Shop")
                        .setDescription("Escolhe o produto que queres adicionar:")
                        .setColor("#8b0000");
                    const selectOptions = menus.map(menu => {
                        let nomeLimpo = menu.title.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, '').trim();
                        if (nomeLimpo.length > 100) nomeLimpo = nomeLimpo.slice(0, 97) + "...";
                        return {
                            label: nomeLimpo || "Produto",
                            description: menu.options[0]?.description || "Ver opcoes",
                            value: menu.id
                        };
                    });
                    const select = new StringSelectMenuBuilder()
                        .setCustomId("adicionar_produto")
                        .setPlaceholder("Seleciona um produto")
                        .addOptions(selectOptions);
                    return interaction.reply({
                        embeds: [embed],
                        components: [new ActionRowBuilder().addComponents(select)],
                        flags: [64]
                    });
                }
                if (interaction.commandName === "carrinho") {
                    const carrinho = client.carrinhos.get(user.id) || [];
                    if (carrinho.length === 0) {
                        return interaction.reply({
                            content: "🛒 O teu carrinho esta vazio!\n\nUsa `/adicionar` para adicionar produtos.",
                            flags: [64]
                        });
                    }
                    let descricao = "";
                    let total = 0;
                    carrinho.forEach((item, index) => {
                        let precoUnit = 0;
                        if (item.options && item.options.length > 0) {
                            const desc = item.options[0].description || "";
                            const match = desc.match(/\d+([.,]\d+)?/);
                            if (match) precoUnit = parseFloat(match[0].replace(',', '.'));
                        }
                        const subtotal = precoUnit * (item.quantidade || 1);
                        total += subtotal;
                        descricao += `**${index + 1}.** ${item.titulo}\n`;
                        descricao += ` Quantidade: **${item.quantidade || 1}**\n`;
                        descricao += ` Preco unitario: €${precoUnit.toFixed(2)}\n`;
                        descricao += ` Subtotal: €${subtotal.toFixed(2)}\n\n`;
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
                    return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
                }
            }

            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid === "menu_produtos")) {
                const tipo = interaction.values[0];
                const embed = new EmbedBuilder()
                    .setTitle("⚖️ Termos de Servico - Jordan Shop")
                    .setDescription(
                        "**Termos de Servico de Reembolso**\n" +
                        "Nao oferecemos reembolsos apos a conclusao de uma compra ou servico. Em casos excepcionais, uma substituicao pode ser oferecida, se possivel.\n\n" +
                        "**Termos de Servico de Substituicao**\n" +
                        "A substituicao so e possivel com um voucher.\n" +
                        "Sem voucher = sem garantia ou substituicao.\n\n" +
                        "**Termos de Servico da Conta**\n" +
                        "Apos receber uma conta, voce devera alterar seu endereco de e-mail e senha imediatamente.\n" +
                        "Nao assumimos qualquer responsabilidade ou substituicao caso voce nao o faca.\n\n" +
                        "**Termos de Servico do PayPal**\n" +
                        "Os pagamentos devem ser enviados via \"Amigos e Familiares\" – sem uma mensagem nos detalhes de pagamento.\n" +
                        "Nao nos responsabilizamos se nossa conta do PayPal for bloqueada e os fundos permanecerem la. Nao ha reembolsos possiveis!\n\n" +
                        "**Idioma do Ticket**\n" +
                        "O suporte e os tickets sao processados exclusivamente em Portugues.\n\n" +
                        "**Comportamento do Ticket**\n" +
                        "Por favor, nao envie spam ou ping varias vezes em DM ou tickets.\n" +
                        "Aguarde pacientemente ate receber seu produto ou uma response.\n\n" +
                        "*Atenciosamente, Jordan.*"
                    )
                    .setColor("#ff0000");
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar os Termos").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar os Termos").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
            }

            if (interaction.isStringSelectMenu() && cid === "adicionar_produto") {
                const menuId = interaction.values[0];
                const menuSelecionado = menus.find(m => m.id === menuId);
                if (!menuSelecionado) {
                    return interaction.reply({ content: "❌ Produto nao encontrado.", ephemeral: true });
                }
                if (!client.carrinhos.has(user.id)) {
                    client.carrinhos.set(user.id, []);
                }
                const carrinhoUser = client.carrinhos.get(user.id);
                carrinhoUser.push({
                    menuId: menuId,
                    titulo: menuSelecionado.title,
                    embedDesc: menuSelecionado.embedDesc,
                    options: menuSelecionado.options,
                    quantidade: 1
                });
                const embed = new EmbedBuilder()
                    .setTitle("✅ Produto adicionado ao carrinho!")
                    .setDescription(`**${menuSelecionado.title}** foi adicionado.\n\nAgora podes:\n• Usar \`/adicionar\` para mais produtos\n• Usar \`/carrinho\` para ver o teu carrinho`)
                    .setColor("#00ff00");
                await interaction.update({
                    embeds: [embed],
                    components: []
                });
            }

            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipoRec = cid.replace("recusar_termos_", "");
                const canalLogs = guild.channels.cache.get(config.STAFF_LOGS_CHANNEL_ID);
                if (canalLogs) {
                    await canalLogs.send({
                        content: `❌ <@${user.id}> (${user.username}) **nao aceitou** os termos para abrir ticket de: \`${tipoRec}\` # 🔵 vpn-service`
                    }).catch(() => {});
                }
                return interaction.update({
                    content: "⚠️ Tens de aceitar os termos para abrir o teu ticket/pedido.",
                    embeds: [],
                    components: []
                });
            }

            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipoAceito = cid.replace("aceitar_termos_", "");

                if (isDuplicateTicketLog(user.id, `aceitar_${tipoAceito}`, channel.id)) {
                    // Ignora duplicado mas continua fluxo
                } else {
                    const canalLogsTicket = guild.channels.cache.get("1521916593402286191");
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

                    if (canalLogsTicket) {
                        const embedLog = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setDescription(
                                `✅ <@${user.id}> (${user.username}) aceitou os termos para abrir ticket de: **${tipoAceito}** ${tagFinal}`
                            )
                            .setTimestamp();
                        await canalLogsTicket.send({ embeds: [embedLog] }).catch(() => {});
                    }
                }

                const menuPagamento = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipoAceito}`)
                    .setPlaceholder("💳 Escolha o metodo de pagamento")
                    .addOptions([
                        { label: "MBWay", value: "MBWay", emoji: "1464608251516813446" },
                        { label: "PayPal", value: "PayPal", emoji: "1464608396383883314" },
                        { label: "Revolut", value: "Revolut", emoji: "1464608485617565726" },
                        { label: "Cartao de Credito", value: "CartaoCredito", emoji: "1464608966826004676" },
                        { label: "Google Pay", value: "GooglePay", emoji: "1464609044315508797" },
                        { label: "Apple Pay", value: "ApplePay", emoji: "1464609102906003588" },
                        { label: "Multibanco", value: "ReferenciaMultibanco", emoji: "1464609317926735902" }
                    ]);
                return interaction.update({
                    content: "✅ **Termos aceites!** Agora seleciona o metodo de pagamento:",
                    embeds: [],
                    components: [new ActionRowBuilder().addComponents(menuPagamento)]
                });
            }

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
                    .setDescription(`📦 **Produto:** ${tipoProd}\n🛡️ **Staff:** <a:threedots:1521920058140659803> Aguardando...\n💳 **Metodo:** ${emoji} ${metodo}`)
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

            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas Staff.", flags: [64] });
                const [uid, met, pdr] = channel.topic?.split("|") || ["?", "Nao definido", "Geral"];
                const emj = emojisPagamento[met] || "💰";
                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n**Produto:** ${pdr}\n**Metodo:** ${emj} ${met}`)
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
                    content: `📢 <@${target.id}> (${target.user.username}), foste solicitado aqui por **${user.username}**!`,
                    components: []
                });
            }

            if (cid === "close_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas staff pode fechar.", flags: [64] });
                const messages = await channel.messages.fetch({ limit: 50 });
                const msgCount = messages.size;
                if (msgCount >= 5) {
                    await interaction.reply(`🔒 Ticket com mensagens suficientes (**${msgCount}**). A gerar transcricao...`);
                    await sendTranscript(channel, user.tag);
                    return setTimeout(() => channel.delete().catch(() => {}), 5000);
                } else {
                    const embedAviso = new EmbedBuilder()
                        .setTitle("⚠️ Poucas Mensagens")
                        .setDescription(`Este ticket tem apenas **${msgCount}** mensagens.\nQueres guardar a transcricao ou apenas fechar?`)
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

            if (interaction.isButton() && interaction.customId.startsWith("fechar_ticket_saida_")) {
                return await handleFecharTicketSaida(interaction, client);
            }

        } catch (err) {
            console.error("❌ Erro Geral no InteractionCreate:", err);
        }
    });
};
