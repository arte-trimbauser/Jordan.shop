const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionsBitField, StringSelectMenuBuilder, ChannelType,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
const config = require("../config");
const isStaff = require("../helpers/isStaff");
const sendTranscript = require("../helpers/sendTranscript");
const menus = require("../menus");
const cooldowns = new Map();
const { handleChamarCommand, handleFecharTicketSaida } = require("../commands/chamarCommand");
const { handleSistemaInteraction } = require("./sistemaCompleto");
const { handleVerificacaoInteraction } = require("./sistemaVerificacao");

// ==================== EMOJIS DE PAGAMENTO ====================
const emojisPagamento = {
    "MBWay": "<:mbway:1464608251516813446>",
    "PayPal": "<:paypal:1464608396383883314>",
    "Revolut": "<:revolut:1464608485617565726>",
    "CartaoCredito": "<:creditcard:1464608966826004676>",
    "GooglePay": "<:googlepay:1464609044315508797>",
    "ApplePay": "<:applepay:1464609102906003588>",
    "ReferenciaMultibanco": "<:multibanco:1464609317926735902>"
};

const metodoNomes = {
    "MBWay": "MBWay",
    "PayPal": "PayPal",
    "Revolut": "Revolut",
    "CartaoCredito": "Cartão de Crédito",
    "GooglePay": "Google Pay",
    "ApplePay": "Apple Pay",
    "ReferenciaMultibanco": "Referência Multibanco"
};

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
            // ===================== COMANDOS SLASH =====================
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
                            description: menu.options[0]?.description || "Ver opções",
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
                            content: "🛒 O teu carrinho está vazio!\n\nUsa `/adicionar` para adicionar produtos.",
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
                        descricao += ` Preço unitário: €${precoUnit.toFixed(2)}\n`;
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
                        new ButtonBuilder().setCustomId("finalizar_carrinho").setLabel("✅ Finalizar Compra").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("limpar_carrinho").setLabel("🗑️ Limpar Carrinho").setStyle(ButtonStyle.Danger)
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: [64] });
                }
            }

            // ===================== SELECT MENUS =====================
            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid === "menu_produtos")) {
                const tipo = interaction.values[0];
                const embed = new EmbedBuilder()
                    .setTitle("⚖️ Termos de Serviço - Jordan Shop")
                    .setDescription(
                        "**Termos de Serviço de Reembolso**\n" +
                        "Não oferecemos reembolsos após a conclusão de uma compra ou serviço. Em casos excecionais, poderá ser oferecida uma substituição, se possível.\n\n" +
                        "**Termos de Serviço de Substituição**\n" +
                        "A substituição só é possível com um *voucher*.\n" +
                        "Sem *voucher* = sem garantia ou substituição.\n\n" +
                        "**Termos de Serviço da Conta**\n" +
                        "Após receber a conta, deve alterar o endereço de e-mail e a palavra-passe imediatamente.\n" +
                        "Não assumimos qualquer responsabilidade ou substituição caso não o faça.\n\n" +
                        "**Termos de Serviço do PayPal**\n" +
                        "Os pagamentos devem ser enviados via \"Amigos e Família\" – sem qualquer mensagem nos detalhes do pagamento.\n" +
                        "Não nos responsabilizamos se a nossa conta do PayPal for bloqueada e os fundos ficarem retidos. Não há reembolsos possíveis!\n\n" +
                        "**Idioma do Ticket**\n" +
                        "O suporte e os *tickets* são processados exclusivamente em português.\n\n" +
                        "**Comportamento no Ticket**\n" +
                        "Por favor, não envie *spam* nem mencione (*ping*) a equipa várias vezes em DM ou nos *tickets*.\n" +
                        "Aguarde pacientemente até receber o seu produto ou uma resposta.\n\n" +
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
                    return interaction.reply({ content: "❌ Produto não encontrado.", ephemeral: true });
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
                await interaction.update({ embeds: [embed], components: [] });
            }

            // ===================== BOTÕES =====================
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipoRec = cid.replace("recusar_termos_", "");
                const canalLogs = guild.channels.cache.get(config.STAFF_LOGS_CHANNEL_ID);
                if (canalLogs) {
                    await canalLogs.send({
                        content: `❌ <@${user.id}> (${user.username}) **não aceitou** os termos para abrir ticket de: \`${tipoRec}\` # 🔵 vpn-service`
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
                    // Ignora duplicado
                } else {
                    const canalLogsTicket = guild.channels.cache.get("1521916593402286191");
                    let tagFinal = "# ⭐ produto";
                    const tipoLower = tipoAceito.toLowerCase();
                    if (tipoLower.includes("steam")) tagFinal = "# ⭐ steam-account";
                    else if (tipoLower.includes("vpn") || tipoLower.includes("cyberghost")) tagFinal = "# 🔵 vpn-service";
                    else if (tipoLower.includes("spoofer") || tipoLower.includes("sp00fer")) tagFinal = "# 🛡️ spoofer";
                    else if (tipoLower.includes("shark")) tagFinal = "# 🦈 shark-menu";
                    else if (tipoLower.includes("stan")) tagFinal = "# 🦍 stan-menu";
                    else if (tipoLower.includes("stellar")) tagFinal = "# ⭐ stellar-menu";
                    else if (tipoLower.includes("lunax")) tagFinal = "# 🌙 lunax-menu";
                    else if (tipoLower.includes("flyside")) tagFinal = "# 🟣 flyside-menu";
                    else if (tipoLower.includes("discord")) tagFinal = "# 💬 discord-account";
                    else if (tipoLower.includes("rockstar")) tagFinal = "# 🎮 rockstar-account";
                    else if (tipoLower.includes("duck")) tagFinal = "# 🦆 duck-cleaner";
                    if (canalLogsTicket) {
                        const embedLog = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setDescription(`✅ <@${user.id}> (${user.username}) aceitou os termos para abrir ticket de: **${tipoAceito}** ${tagFinal}`)
                            .setTimestamp();
                        await canalLogsTicket.send({ embeds: [embedLog] }).catch(() => {});
                    }
                }
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

            // ===================== CRIAÇÃO DE TICKET =====================
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferReply({ flags: [64] });
                const tipoProd = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";
                const metodoNome = metodoNomes[metodo] || metodo;
                const produtoExibicao = tipoProd.replace(/_/g, ' ');

                const CATEGORIA_GERAL = "1457415165380268134";
                const CATEGORIA_ESPECIAL = "1490783459470475414";

                const ticketsExistentes = guild.channels.cache.filter(ch =>
                    ch.type === ChannelType.GuildText &&
                    ch.name.startsWith(`ticket-`) &&
                    ch.topic &&
                    ch.topic.startsWith(`${user.id}|`) &&
                    ch.parentId !== null
                );

                const isEspecial = tipoProd.includes("vpn") || tipoProd.includes("cyberghost") || tipoProd.includes("tunnelbear") || tipoProd.includes("ipvanish");
                const categoriaDestino = isEspecial ? CATEGORIA_ESPECIAL : CATEGORIA_GERAL;

                const ticketExistente = ticketsExistentes.find(ch => ch.parentId === categoriaDestino);

                if (ticketExistente) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`adicionar_carrinho_${tipoProd}`)
                            .setLabel("➕ Adicionar ao Carrinho")
                            .setStyle(ButtonStyle.Success)
                    );
                    return await interaction.editReply({
                        content: `🚫 **Stop!** Já tens um ticket aberto: <#${ticketExistente.id}>\n\n` +
                                 `Podes adicionar este produto ao teu **carrinho** para comprar mais tarde, ou usar o botão **Adicionar Produto** no ticket existente.\n` +
                                 `Para consultares o teu carrinho, usa o comando \`/carrinho\`.`,
                        components: [row],
                        flags: [64]
                    });
                }

                const ticket = await guild.channels.create({
                    name: `ticket-${tipoProd}-${user.username}`.toLowerCase(),
                    type: ChannelType.GuildText,
                    parent: categoriaDestino,
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
                    .setTitle("Jordan Shop | Tickets")
                    .setDescription(
                        `📦 **Produto:** ${produtoExibicao}\n` +
                        `🛡️ **Staff:** ⏳ Aguardando <:threedots:1521920058140659803>\n` +
                        `💳 **Método:** ${emoji} ${metodoNome}`
                    )
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("🙋‍♂️ Assumir o Ticket").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("❌ Fechar o Ticket").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({
                    content: `<@${user.id}> obrigado(a) por criar um ticket, em breve algum staff te ajudará`,
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
                    content: `✅ O teu Ticket/Pedido foi criado com sucesso: <#${ticket.id}>`,
                    components: [rowGo]
                });
            }

            // ============================================================
            // BOTÃO "ADICIONAR AO CARRINHO" (quando já tem ticket)
            // ============================================================
            if (interaction.isButton() && cid?.startsWith("adicionar_carrinho_")) {
                const tipoProd = cid.replace("adicionar_carrinho_", "");
                // Procurar o menu que contém esta opção
                let menuSelecionado = null;
                let opcaoSelecionada = null;
                for (const menu of menus) {
                    const opcao = menu.options.find(o => o.value === tipoProd);
                    if (opcao) {
                        menuSelecionado = menu;
                        opcaoSelecionada = opcao;
                        break;
                    }
                }
                if (!menuSelecionado || !opcaoSelecionada) {
                    return interaction.reply({ content: "❌ Produto não encontrado.", ephemeral: true });
                }
                if (!client.carrinhos.has(user.id)) {
                    client.carrinhos.set(user.id, []);
                }
                const carrinhoUser = client.carrinhos.get(user.id);
                carrinhoUser.push({
                    menuId: menuSelecionado.id,
                    titulo: menuSelecionado.title,
                    embedDesc: menuSelecionado.embedDesc,
                    options: menuSelecionado.options,
                    quantidade: 1
                });
                await interaction.reply({
                    content: `✅ **${menuSelecionado.title}** foi adicionado ao teu carrinho!\n\nUsa \`/carrinho\` para ver o teu carrinho.`,
                    ephemeral: true
                });
                return;
            }

            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Apenas Staff.", flags: [64] });
                const [uid, met, pdr] = channel.topic?.split("|") || ["?", "Não definido", "Geral"];
                const emj = emojisPagamento[met] || "💰";
                const metodoNome = metodoNomes[met] || met;
                const produtoExibicao = pdr.replace(/_/g, ' ');
                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n**Produto:** ${produtoExibicao}\n**Método:** ${emj} ${metodoNome}`)
                    .setColor("#57f287")
                    .setFooter({ text: "Jordan Shop | Tickets" });
                return await interaction.update({
                    embeds: [embedClaim],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("claimed").setLabel("✅ Ticket Assumido").setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("close_ticket").setLabel("❌ Fechar o Ticket").setStyle(ButtonStyle.Danger)
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

            // ============================================================
            // BOTÃO FECHAR TICKET – PERGUNTAR SE HOUVE VENDA
            // ============================================================
            if (cid === "close_ticket") {
                if (!isStaff(member)) {
                    return interaction.reply({ content: "Apenas staff pode fechar.", flags: 64 });
                }

                const CATEGORIA_SEM_VENDA = "1490783459470475414";
                const isCategoriaProibida = channel.parentId === CATEGORIA_SEM_VENDA;

                if (isCategoriaProibida) {
                    return await fecharTicketComOuSemTranscript(interaction, channel, member);
                }

                const embedPergunta = new EmbedBuilder()
                    .setTitle("📝 Registo de Venda")
                    .setDescription("Houve venda neste ticket?")
                    .setColor("#8b0000");

                const rowBotoes = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("venda_sim")
                        .setLabel("✅ Sim, houve venda")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId("venda_nao")
                        .setLabel("❌ Não, fechar apenas")
                        .setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({
                    embeds: [embedPergunta],
                    components: [rowBotoes],
                    flags: [64]
                });
                return;
            }

            // ============================================================
            // BOTÃO "SIM, HOUVE VENDA" – ABRIR MODAL
            // ============================================================
            if (interaction.isButton() && cid === "venda_sim") {
                const topic = channel.topic || '';
                const [userId, , produtoDoTopico] = topic.split('|');
                const produtoPreenchido = produtoDoTopico ? produtoDoTopico.replace(/_/g, ' ') : 'Não especificado';

                let compradorPreenchido = '';
                if (userId) {
                    try {
                        const userTicket = await client.users.fetch(userId);
                        compradorPreenchido = `<@${userId}>/${userTicket.username}`;
                    } catch {
                        compradorPreenchido = 'Utilizador desconhecido';
                    }
                }

                const hoje = new Date();
                const dia = String(hoje.getDate()).padStart(2, '0');
                const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                const ano = hoje.getFullYear();
                const dataHoje = `${dia}-${mes}-${ano}`;

                const modal = new ModalBuilder()
                    .setCustomId('modal_venda_fechamento')
                    .setTitle('📝 Registar Venda');

                const compradorInput = new TextInputBuilder()
                    .setCustomId('venda_comprador')
                    .setLabel('Nome do Comprador')
                    .setStyle(TextInputStyle.Short)
                    .setValue(compradorPreenchido)
                    .setRequired(true)
                    .setMaxLength(100);

                const dataInput = new TextInputBuilder()
                    .setCustomId('venda_data')
                    .setLabel('Data de Venda (DD-MM-AAAA)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(dataHoje)
                    .setRequired(true)
                    .setMaxLength(10);

                const produtoInput = new TextInputBuilder()
                    .setCustomId('venda_produto')
                    .setLabel('Produto')
                    .setStyle(TextInputStyle.Short)
                    .setValue(produtoPreenchido)
                    .setRequired(true)
                    .setMaxLength(200);

                const duracaoInput = new TextInputBuilder()
                    .setCustomId('venda_duracao')
                    .setLabel('Duração do Produto')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ex: Lifetime, 15 dias, Semanal...')
                    .setRequired(false)
                    .setMaxLength(50);

                const staffInput = new TextInputBuilder()
                    .setCustomId('venda_staff')
                    .setLabel('Staff responsável')
                    .setStyle(TextInputStyle.Short)
                    .setValue(member.displayName || member.user.username)
                    .setRequired(true)
                    .setMaxLength(100);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(compradorInput),
                    new ActionRowBuilder().addComponents(dataInput),
                    new ActionRowBuilder().addComponents(produtoInput),
                    new ActionRowBuilder().addComponents(duracaoInput),
                    new ActionRowBuilder().addComponents(staffInput)
                );

                await interaction.showModal(modal);
                return;
            }

            // ============================================================
            // BOTÃO "NÃO, FECHAR APENAS"
            // ============================================================
            if (interaction.isButton() && cid === "venda_nao") {
                await interaction.reply({ content: "🔒 A fechar ticket sem registo de venda...", flags: 64 });
                return await fecharTicketComOuSemTranscript(interaction, channel, member);
            }

            // ============================================================
            // MODAL SUBMIT – REGISTAR VENDA
            // ============================================================
            if (interaction.isModalSubmit() && interaction.customId === 'modal_venda_fechamento') {
                const { fields, member, channel } = interaction;
                const comprador = fields.getTextInputValue('venda_comprador');
                const data = fields.getTextInputValue('venda_data');
                const produto = fields.getTextInputValue('venda_produto');
                const duracao = fields.getTextInputValue('venda_duracao') || 'N/A';
                const staff = fields.getTextInputValue('venda_staff');

                await interaction.reply({ content: '✅ Venda registada! A fechar ticket...', flags: 64 });

                try {
                    const canalVendas = await client.channels.fetch('1393689118717771786');
                    if (canalVendas) {
                        const embedVenda = new EmbedBuilder()
                            .setTitle('🛒 Nova Venda Registrada')
                            .setColor('#8b0000')
                            .addFields(
                                { name: '👤 Comprador', value: comprador, inline: true },
                                { name: '📅 Data', value: data, inline: true },
                                { name: '📦 Produto', value: produto, inline: false },
                                { name: '⏱️ Duração', value: duracao, inline: true },
                                { name: '🛡️ Staff', value: staff, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'Jordan Shop Vendas', iconURL: client.user.displayAvatarURL() });

                        await canalVendas.send({ embeds: [embedVenda] });
                    }
                } catch (err) {
                    console.error('❌ Erro ao enviar embed de venda:', err);
                }

                try {
                    await sendTranscript(channel, member.displayName || member.user.username);
                    setTimeout(() => channel.delete().catch(() => {}), 3000);
                } catch (err) {
                    console.error('❌ Erro ao fechar ticket após venda:', err);
                }
                return;
            }

            // ============================================================
            // BOTÕES DE TRANSCRIPT (staff especial)
            // ============================================================
            if (interaction.isButton() && cid === "transcript_guardar") {
                await interaction.update({ content: "🔒 A guardar transcript e a fechar...", embeds: [], components: [], flags: [64] });
                await sendTranscript(channel, member.displayName || member.user.username);
                setTimeout(() => channel.delete().catch(() => {}), 3000);
                return;
            }

            if (interaction.isButton() && cid === "transcript_nao_guardar") {
                await interaction.update({ content: "❌ Ticket fechado sem transcript.", embeds: [], components: [], flags: [64] });
                setTimeout(() => channel.delete().catch(() => {}), 3000);
                return;
            }

            // ============================================================
            // FECHAR TICKET QUANDO CLIENTE SAIU
            // ============================================================
            if (interaction.isButton() && interaction.customId.startsWith("fechar_ticket_saida_")) {
                return await handleFecharTicketSaida(interaction, client);
            }

        } catch (err) {
            console.error("❌ Erro Geral no InteractionCreate:", err);
        }
    });
};

// ============================================================
// FUNÇÃO AUXILIAR – PERGUNTAR SOBRE TRANSCRIPT (APENAS PARA STAFF ESPECÍFICO)
// ============================================================
async function fecharTicketComOuSemTranscript(interaction, channel, member) {
    const STAFF_ID_ESPECIAL = "996454465555136675";
    const isStaffEspecial = member.id === STAFF_ID_ESPECIAL;

    let mensagens = await channel.messages.fetch({ limit: 100 });
    let count = mensagens.size;

    // Se a interação não foi respondida nem deferida, respondemos com loading
    if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Processando...", flags: 64 });
    }

    const replyMethod = interaction.replied || interaction.deferred ? interaction.editReply : interaction.reply;

    if (!isStaffEspecial || count >= 5) {
        await replyMethod.call(interaction, { content: "🔒 A fechar com transcript...", flags: 64 });
        await sendTranscript(channel, member.displayName || member.user.username);
        setTimeout(() => channel.delete().catch(() => {}), 3000);
        return;
    }

    const embedPergunta = new EmbedBuilder()
        .setTitle("📄 Guardar Transcript?")
        .setDescription(`Este ticket tem apenas **${count}** mensagens.\nDesejas guardar o transcript antes de fechar?`)
        .setColor("#f1c40f");

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("transcript_guardar")
            .setLabel("✅ Guardar e Fechar")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("transcript_nao_guardar")
            .setLabel("❌ Fechar sem Guardar")
            .setStyle(ButtonStyle.Danger)
    );

    await replyMethod.call(interaction, {
        embeds: [embedPergunta],
        components: [row],
        flags: [64]
    });
}
