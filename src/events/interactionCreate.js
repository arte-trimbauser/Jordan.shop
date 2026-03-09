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

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

async function sendTranscript(channel, userTag) {
    const pastaTranscripts = path.join(__dirname, "../../transcripts");
    if (!fs.existsSync(pastaTranscripts)) {
        fs.mkdirSync(pastaTranscripts, { recursive: true });
    }

    const attachment = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        filename: `ticket-${channel.name}.html`,
        saveImages: true,
        poweredBy: false
    });

    const nome = `ticket-${channel.name}.html`.replace(/\s+/g, "_");
    const caminho = path.join(pastaTranscripts, nome);
    fs.writeFileSync(caminho, attachment.attachment);

    // Link Corrigido para o Oficial
    const transcriptURL = `https://discord-bott-jordan.onrender.com/transcripts/${nome}`;

    const logChannel = await channel.guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);

    if (logChannel) {
        const embed = new EmbedBuilder()
            .setTitle("📄 Transcrição Arquivada")
            .setDescription(`Canal: ${channel.name}\nFechado por: ${userTag}\n\n🔗 Ver transcript:\n${transcriptURL}`)
            .setColor("#ff0000")
            .setTimestamp();

        await logChannel.send({
            embeds: [embed],
            files: [attachment]
        });
    }
    return nome;
}

module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        try {
            const { channel, user, customId: cid } = interaction;

            /* 1. MENU TICKET -> AGORA MOSTRA OS TERMOS PRIMEIRO */
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];

                const termosEmbed = new EmbedBuilder()
                    .setTitle("📜 Termos de Serviço")
                    .setDescription(`
🔁 **Termos de Serviço de Reembolso**
Não oferecemos reembolsos após a conclusão de uma compra ou serviço.

🔄 **Termos de Serviço de Substituição**
A substituição só é possível com um voucher.
Sem voucher = sem garantia ou substituição.

👤 **Termos de Serviço da Conta**
Altere e-mail e senha imediatamente. Não nos responsabilizamos após a entrega.

💸 **Termos de Serviço do PayPal**
Pagamentos via "Amigos e Familiares" – sem mensagem.

🌐 **Idioma do Ticket**
Suporte apenas em Português.

**Atenciosamente, Jordan.**`)
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [termosEmbed], components: [row], flags: [MessageFlags.Ephemeral] });
            }

            /* 2. LÓGICA DOS TERMOS (INTERCALADA) */
            if (interaction.isButton()) {
                
                if (cid === "recusar_termos") {
                    console.log(`📢 Log: ${user.tag} não aceitou os termos.`);
                    return interaction.reply({ content: `❌ <@${user.id}> não aceitou os termos. Tens que aceitar os termos para abrir o ticket.`, flags: [MessageFlags.Ephemeral] });
                }

                if (cid.startsWith("aceitar_termos_")) {
                    const tipo = cid.replace("aceitar_termos_", "");
                    console.log(`📢 Log: ${user.tag} aceitou os termos.`);

                    await interaction.update({ content: "⏳ A criar ticket...", embeds: [], components: [] });

                    let category = interaction.guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
                    if (!category) category = await interaction.guild.channels.create({ name: config.CATEGORY_NAME, type: 4 });

                    const canal = await interaction.guild.channels.create({
                        name: `ticket-${tipo}-${user.username}`.toLowerCase(),
                        parent: category.id,
                        topic: user.id,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                            ...config.STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                        ]
                    });

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                    );

                    await canal.send({
                        content: `✅ <@${user.id}> aceitou os termos!\nObrigado(a) por criar um ticket, em breve algum staff te ajudará.`,
                        components: [row]
                    });

                    return interaction.editReply({ content: `Ticket criado: <#${canal.id}>` });
                }

                /* REIVINDICAR TICKET */
                if (cid === "claim_ticket") {
                    await interaction.update({
                        content: `🛡 Ticket ${channel.name} reivindicado por <@${user.id}>`,
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                                new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                            )
                        ]
                    });
                }

                /* CHAMAR STAFF */
                if (cid === "call_staff") {
                    const isDev = config.DEV_IDS.includes(user.id);
                    if (!isDev) {
                        const last = staffCooldown.get(user.id);
                        if (last && Date.now() - last < STAFF_WAIT) {
                            const remaining = Math.ceil((STAFF_WAIT - (Date.now() - last)) / 60000);
                            return interaction.reply({ content: `faltam ${remaining} minutos até poder chamar staff novamente.`, flags: [MessageFlags.Ephemeral] });
                        }
                        staffCooldown.set(user.id, Date.now());
                    }

                    const options = config.STAFF_MEMBERS.map(s => ({ label: s.label, value: s.id }));
                    const select = new StringSelectMenuBuilder()
                        .setCustomId("select_staff")
                        .setPlaceholder("Seleciona o staff")
                        .addOptions(options);

                    return interaction.reply({
                        content: "Seleciona o staff que queres chamar:",
                        components: [new ActionRowBuilder().addComponents(select)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                /* FECHAR TICKET */
                if (cid === "close_ticket") {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    if (messages.size < 5) {
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("confirm_close_transcript").setLabel("Fechar com transcript").setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId("confirm_close_no_transcript").setLabel("Fechar sem transcript").setStyle(ButtonStyle.Secondary)
                        );
                        return interaction.reply({ content: "Este ticket tem poucas mensagens. Precisas de transcript?", components: [row] });
                    }
                    await interaction.reply("A gerar transcript e fechar...");
                    await sendTranscript(channel, user.tag);
                    setTimeout(() => channel.delete().catch(() => {}), 5000);
                }

                /* CONFIRMAR COM TRANSCRIPT */
                if (cid === "confirm_close_transcript") {
                    await interaction.update({ content: "A gerar transcript...", components: [] });
                    await sendTranscript(channel, user.tag);
                    setTimeout(() => channel.delete().catch(() => {}), 5000);
                }

                /* FECHAR SEM TRANSCRIPT */
                if (cid === "confirm_close_no_transcript") {
                    await interaction.update({ content: "Ticket fechado.", components: [] });
                    setTimeout(() => channel.delete().catch(() => {}), 3000);
                }
            }

            /* SELECIONAR STAFF (Menu) */
            if (interaction.isStringSelectMenu() && cid === "select_staff") {
                const staffId = interaction.values[0];
                await channel.send(`🔔 <@${staffId}> foi chamado por <@${user.id}>`);
                return interaction.update({ content: "staff chamado.", components: [] });
            }

        } catch (err) {
            console.error("Erro interaction:", err);
        }
    });
};
