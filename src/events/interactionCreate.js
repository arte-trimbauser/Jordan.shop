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
const sendCallDM = require("../helpers/sendCallDM"); 
const fs = require("fs");
const path = require("path");

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

async function sendTranscript(channel, userTag) {
    const pastaTranscripts = path.join(__dirname, "../../transcripts");
    if (!fs.existsSync(pastaTranscripts)) fs.mkdirSync(pastaTranscripts, { recursive: true });

    const attachment = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        filename: `ticket-${channel.name}.html`,
        saveImages: true,
        poweredBy: false
    });

    const nome = `ticket-${channel.name}.html`.replace(/\s+/g, "_");
    fs.writeFileSync(path.join(pastaTranscripts, nome), attachment.attachment);

    const transcriptURL = `https://discord-bott-jordan.onrender.com/transcripts/${nome}`;
    const logChannel = await channel.guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);

    if (logChannel) {
        const embed = new EmbedBuilder()
            .setTitle("📄 Transcrição Arquivada")
            .setDescription(`Canal: ${channel.name}\nFechado por: ${userTag}\n\n🔗 Ver: ${transcriptURL}`)
            .setColor("#ff0000")
            .setTimestamp();
        await logChannel.send({ embeds: [embed], files: [attachment] });
    }
    return nome;
}

module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        try {
            const { channel, user, customId: cid, guild } = interaction;

            /* 1. MENU -> TERMOS */
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];
                const termosEmbed = new EmbedBuilder()
                    .setTitle("📜 Termos de Serviço")
                    .setDescription(`🔁 **Reembolsos:** Não oferecemos reembolsos.\n🔄 **Substituição:** Apenas com voucher.\n👤 **Contas:** Altere os dados imediatamente.\n💸 **PayPal:** Amigos e Familiares.\n🌐 **Suporte:** Português.`)
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ embeds: [termosEmbed], components: [row], flags: [MessageFlags.Ephemeral] });
            }

            if (interaction.isButton()) {
                if (cid === "recusar_termos") return interaction.reply({ content: "❌ Tens de aceitar os termos.", flags: [MessageFlags.Ephemeral] });

                /* 2. ACEITAR -> PAGAMENTO */
                if (cid.startsWith("aceitar_termos_")) {
                    const tipo = cid.replace("aceitar_termos_", "");
                    const pagEmbed = new EmbedBuilder()
                        .setTitle("💳 Métodos de Pagamento")
                        .setDescription(`Escolha o seu método de pagamento preferido abaixo.\n\n⚠️ **Pagamento antecipado obrigatório** ⚠️`)
                        .setColor("#00ff00");

                    const rowPag = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`pagamento_${tipo}`)
                            .setPlaceholder("Selecione o Método de Pagamento")
                            .addOptions([
                                { label: 'MBWay', value: 'MBWay', emoji: '1464608251516813446' },
                                { label: 'PayPal', value: 'PayPal', emoji: '1464608396383883314' },
                                { label: 'Revolut', value: 'Revolut', emoji: '1464608485617565726' },
                                { label: 'Cartão de Crédito', value: 'CartãoCredito', emoji: '1464608966826004676' },
                                { label: 'Google Pay', value: 'GooglePay', emoji: '1464609044315508797' },
                                { label: 'Apple Pay', value: 'ApplePay', emoji: '1464609102906003588' },
                                { label: 'Ref. Multibanco', value: 'ReferenciaMultibanco', emoji: '1464609317926735902' }
                            ])
                    );
                    return interaction.update({ embeds: [pagEmbed], components: [rowPag], flags: [MessageFlags.Ephemeral] });
                }

                /* 3. REIVINDICAR */
                if (cid === "claim_ticket") {
                    const info = channel.topic ? channel.topic.split("|") : ["?", "Não especificado"];
                    const metodo = info[1] || "Não especificado";
                    
                    await interaction.update({
                        content: `🛡️ **Ticket** \`${channel.name}\` reivindicado por <@${user.id}>\n💳 **Método escolhido:** \`${metodo}\``,
                        components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                            new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                        )]
                    });
                }

                /* 4. CHAMAR STAFF */
                if (cid === "call_staff") {
                    const isDev = config.DEV_IDS.includes(user.id);
                    if (!isDev) {
                        const last = staffCooldown.get(user.id);
                        if (last && Date.now() - last < STAFF_WAIT) {
                            const remaining = Math.ceil((STAFF_WAIT - (Date.now() - last)) / 60000);
                            return interaction.reply({ content: `Aguarde ${remaining} min para chamar novamente.`, flags: [MessageFlags.Ephemeral] });
                        }
                        staffCooldown.set(user.id, Date.now());
                    }

                    const members = await guild.members.fetch();
                    const staffDisponivel = members.filter(m => 
                        m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) && !m.user.bot
                    );

                    if (staffDisponivel.size === 0) return interaction.reply({ content: "❌ Nenhum Staff online.", flags: [MessageFlags.Ephemeral] });

                    const options = staffDisponivel.map(m => ({
                        label: m.displayName,
                        value: m.id,
                        description: `Cargo: ${m.roles.highest.name}`
                    })).slice(0, 25);

                    const select = new StringSelectMenuBuilder()
                        .setCustomId("select_staff")
                        .setPlaceholder("Seleciona o staff para notificar")
                        .addOptions(options);

                    return interaction.reply({ 
                        content: "Selecione o staff:", 
                        components: [new ActionRowBuilder().addComponents(select)], 
                        flags: [MessageFlags.Ephemeral] 
                    });
                }

                /* 5. FECHAR TICKET */
                if (cid === "close_ticket") {
                    await interaction.reply({ content: "📂 A gerar transcript e fechar...", flags: [MessageFlags.Ephemeral] });
                    await sendTranscript(channel, user.tag);
                    setTimeout(() => channel.delete().catch(() => {}), 5000);
                }
            }

            /* SELECIONAR STAFF */
            if (interaction.isStringSelectMenu() && cid === "select_staff") {
                const staffId = interaction.values[0];
                await sendCallDM({ toUserId: staffId, fromUser: user, channel: channel, isStaffCall: false });
                await channel.send(`🔔 <@${staffId}> foi chamado via DM por <@${user.id}>`);
                return interaction.update({ content: "✅ Staff notificado!", components: [] });
            }

            /* CRIAÇÃO DO CANAL */
            if (interaction.isStringSelectMenu() && cid.startsWith("pagamento_")) {
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];

                await interaction.update({ content: "⏳ A abrir ticket...", embeds: [], components: [] });

                let category = guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
                if (!category) category = await guild.channels.create({ name: config.CATEGORY_NAME, type: 4 });

                const canal = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`.toLowerCase(),
                    parent: category.id,
                    topic: `${user.id}|${metodo}`, 
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const embedBoasVindas = new EmbedBuilder()
                    .setTitle(`🎫 Ticket Aberto - ${tipo}`)
                    .setDescription(`Olá <@${user.id}>, bem-vindo ao teu ticket.\n💳 Método: **${metodo}**\n\nAguarde um momento pela Staff.`)
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡️ Reivindicar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await canal.send({ content: `<@${user.id}> | @here`, embeds: [embedBoasVindas], components: [row] });
            }

        } catch (err) {
            console.error("Erro na interação:", err);
        }
    });
};
