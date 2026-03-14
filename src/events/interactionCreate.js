const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    StringSelectMenuBuilder, 
    MessageFlags 
} = require("discord.js");

const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");
const isStaff = require("../helpers/isStaff");

// Mapeamento de Emojis para os Métodos
const emojisPagamento = {
    "MBWay": "<:mbway:1464608251516813446>",
    "PayPal": "<:paypal:1464608396383883314>",
    "Revolut": "<:revolut:1464608485617565726>",
    "CartaoCredito": "<:creditcard:1464608966826004676>",
    "GooglePay": "<:googlepay:1464609044315508797>",
    "ApplePay": "<:applepay:1464609102906003588>",
    "ReferenciaMultibanco": "<:multibanco:1464609317926735902>"
};

async function sendLog(guild, text, embed = null) {
    try {
        const logChannelId = config.TRANSCRIPT_LOG_CHANNEL_ID || config.LOG_CHANNEL_ID;
        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
            await logChannel.send({ content: text, embeds: embed ? [embed] : [] });
        }
    } catch (err) { console.error("Erro ao enviar log:", err); }
}

module.exports = (client) => {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction) return;

        try {
            const { guild, channel, user, member } = interaction;
            const cid = interaction.customId;
            if (!guild) return;

            /* 1. MENU TICKET -> MOSTRA TERMOS */
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
                    new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [embedTermos], components: [row], flags: [MessageFlags.Ephemeral] });
            }

            /* 2. RECUSAR TERMOS */
            if (interaction.isButton() && cid === "recusar_termos") {
                return interaction.reply({ content: "❌ Precisas de aceitar os termos para abrir um ticket.", flags: [MessageFlags.Ephemeral] });
            }

            /* 3. ACEITAR TERMOS -> ESCOLHER PAGAMENTO */
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");
                const embedPag = new EmbedBuilder()
                    .setTitle("💳 Método de Pagamento")
                    .setDescription(`Como pretendes pagar o teu pedido de **${tipo}**?`)
                    .setColor("#00ff99");

                const menuPag = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("Seleciona o método...")
                    .addOptions([
                        { label: "MBWay", value: "MBWay", emoji: "1464608251516813446" },
                        { label: "PayPal", value: "PayPal", emoji: "1464608396383883314" },
                        { label: "Revolut", value: "Revolut", emoji: "1464608485617565726" },
                        { label: "Ref. Multibanco", value: "ReferenciaMultibanco", emoji: "1464609317926735902" }
                    ]);

                return interaction.update({ embeds: [embedPag], components: [new ActionRowBuilder().addComponents(menuPag)] });
            }

            /* 4. CRIAR O CANAL DO TICKET */
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emojiMetodo = emojisPagamento[metodo] || "💰";

                await interaction.update({ content: "⏳ A criar o teu canal de suporte...", embeds: [], components: [] });

                let category = guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
                if (!category) category = await guild.channels.create({ name: config.CATEGORY_NAME, type: 4 });

                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    parent: category.id,
                    topic: `${user.id}|${metodo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const embedTicket = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`Olá <@${user.id}>, em breve algum staff te ajudará.\n\n🛡️ **Staff:** Aguardando...\n${emojiMetodo} **Método:** ${metodo}`)
                    .setColor("#2f3136");

                const rowBtns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ content: `<@${user.id}>`, embeds: [embedTicket], components: [rowBtns] });
                return interaction.editReply({ content: `✅ Ticket criado com sucesso: ${ticket}` });
            }

            /* 5. REIVINDICAR TICKET */
            if (interaction.isButton() && cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "❌ Apenas a equipa de Staff pode fazer isto.", flags: [MessageFlags.Ephemeral] });

                const info = channel.topic?.split("|") || [];
                const metodo = info[1] || "Não definido";
                const emojiMetodo = emojisPagamento[metodo] || "💰";

                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n${emojiMetodo} **Método:** ${metodo}`)
                    .setColor("#57f287");

                return interaction.update({
                    embeds: [embedClaim],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("claimed").setLabel("Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                            new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                        )
                    ]
                });
            }

            /* 6. CHAMAR STAFF (ORDEM DE CARGO E ALFABÉTICA) */
            if (interaction.isButton() && cid === "call_staff_list") {
                const members = await guild.members.fetch();
                const staffDisponivel = members.filter(m => m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) && !m.user.bot);

                const sortedStaff = staffDisponivel.sort((a, b) => {
                    const aPos = config.STAFF_ROLES.indexOf(a.roles.highest.id);
                    const bPos = config.STAFF_ROLES.indexOf(b.roles.highest.id);
                    if (aPos !== bPos) return aPos - bPos;
                    return a.displayName.localeCompare(b.displayName);
                });

                const options = sortedStaff.map(m => ({
                    label: m.displayName,
                    value: m.id,
                    description: `Cargo: ${m.roles.highest.name}`
                })).slice(0, 25);

                if (options.length === 0) return interaction.reply({ content: "Nenhum Staff disponível no momento.", flags: [MessageFlags.Ephemeral] });

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("notify_staff_id")
                    .setPlaceholder("Escolhe o membro da equipa...")
                    .addOptions(options);

                return interaction.reply({ content: "Qual membro da Staff desejas chamar?", components: [new ActionRowBuilder().addComponents(menu)], flags: [MessageFlags.Ephemeral] });
            }

            if (interaction.isStringSelectMenu() && cid === "notify_staff_id") {
                const staffId = interaction.values[0];
                await channel.send(`🔔 <@${staffId}>, foste solicitado por <@${user.id}> neste ticket!`);
                return interaction.update({ content: "✅ Staff notificado com sucesso.", components: [] });
            }

            /* 7. LÓGICA DE FECHAR TICKET */
            if (interaction.isButton() && cid === "close_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "❌ Não tens permissão para fechar tickets.", flags: [MessageFlags.Ephemeral] });

                const msgs = await channel.messages.fetch({ limit: 10 });
                if (msgs.size > 5) {
                    await interaction.reply({ content: "📂 O ticket tem atividade. A gerar registos e a fechar..." });
                    return await finalizarCanal(interaction, true);
                } else {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("save_and_close").setLabel("Guardar e Fechar").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("delete_only").setLabel("Apenas Apagar").setStyle(ButtonStyle.Danger)
                    );
                    return interaction.reply({ content: "⚠️ Este ticket tem poucas mensagens. Queres guardar o log antes de apagar?", components: [row], flags: [MessageFlags.Ephemeral] });
                }
            }

            if (cid === "save_and_close") await finalizarCanal(interaction, true);
            if (cid === "delete_only") await finalizarCanal(interaction, false);

        } catch (err) { console.error("Erro na Interação:", err); }
    });
};

/* FUNÇÃO PARA FINALIZAR O CANAL E GERAR O LINK WEB */
async function finalizarCanal(interaction, salvar) {
    const { channel, guild, user } = interaction;
    if (salvar) {
        try {
            const attachment = await discordTranscripts.createTranscript(channel, { limit: -1, fileName: `ticket-${channel.name}.html` });
            const transcriptsDir = path.join(__dirname, "../../transcripts");
            if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

            const fileName = `ticket-${channel.name}.html`.replace(/\s+/g, "_");
            fs.writeFileSync(path.join(transcriptsDir, fileName), attachment.attachment);

            const siteUrl = `https://discord-bott-jordan.onrender.com/transcripts/${fileName}`;
            
            const embedLog = new EmbedBuilder()
                .setTitle("📄 Registo de Ticket Encerrado")
                .setColor("#5865F2")
                .addFields(
                    { name: "Ticket", value: `#${channel.name}`, inline: true },
                    { name: "Encerrado por", value: user.tag, inline: true },
                    { name: "Visualização Web", value: `[Clica aqui para abrir](${siteUrl})` }
                )
                .setTimestamp();

            await sendLog(guild, `✅ Registo guardado para o ticket #${channel.name}`, embedLog);
        } catch (e) { console.error("Erro ao gerar transcript:", e); }
    } else {
        await sendLog(guild, `🗑️ Ticket #${channel.name} foi apagado sem registo por ${user.tag}.`);
    }
    
    // Pequeno atraso para o Staff ver a confirmação antes do canal desaparecer
    setTimeout(() => channel.delete().catch(() => {}), 3000);
}
