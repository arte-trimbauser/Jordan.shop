const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const config = require("../config");

// Importar os helpers
const isStaff = require("../helpers/isStaff");
const sendCallDM = require("../helpers/sendCallDM");
const sendTranscript = require("../helpers/sendTranscript");

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

// IMPORTANTE: Aqui NÃO usamos async
module.exports = (client) => {
    
    // O async entra apenas aqui dentro do evento
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.guild) return;

        const { channel, user, guild, customId: cid, member } = interaction;

        try {
            // --- BOTÃO: CHAMAR STAFF ---
            if (interaction.isButton() && cid === "call_staff") {
                const isDev = config.DEV_IDS?.includes(user.id);
                const last = staffCooldown.get(user.id);

                if (!isDev && last && (Date.now() - last < STAFF_WAIT)) {
                    const tempoRestante = STAFF_WAIT - (Date.now() - last);
                    const minutos = Math.floor(tempoRestante / 60000);
                    const segundos = Math.floor((tempoRestante % 60000) / 1000);
                    let msgT = minutos > 0 ? `**${minutos}m e ${segundos}s**` : `**${segundos}s**`;
                    return interaction.reply({ content: `⏳ Aguarda ${msgT}.`, flags: [MessageFlags.Ephemeral] });
                }

                const members = await guild.members.fetch({ withPresences: true });
                const staffList = members.filter(m => isStaff(m) && !m.user.bot);

                if (staffList.size === 0) return interaction.reply({ content: "❌ Sem staff online.", flags: [MessageFlags.Ephemeral] });

                const options = staffList.map(m => ({ label: m.displayName, value: m.id, description: `Cargo: ${m.roles.highest.name}` })).slice(0, 25);
                const menu = new StringSelectMenuBuilder().setCustomId("select_staff").setPlaceholder("Escolhe o Staff").addOptions(options);
                
                if (!isDev) staffCooldown.set(user.id, Date.now());
                return interaction.reply({ content: "Selecione o staff:", components: [new ActionRowBuilder().addComponents(menu)], flags: [MessageFlags.Ephemeral] });
            }

            // --- SELEÇÃO DE STAFF ---
            if (interaction.isStringSelectMenu() && cid === "select_staff") {
                const staffId = interaction.values[0];
                await sendCallDM({ toUserId: staffId, fromUser: user, channel: channel, isStaffCall: isStaff(member) });
                return interaction.update({ content: `✅ <@${staffId}> notificado!`, components: [] });
            }

            // --- BOTÃO: REIVINDICAR ---
            if (interaction.isButton() && cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "❌ Só staff!", flags: [MessageFlags.Ephemeral] });
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡️ Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                    new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );
                await interaction.update({ components: [row] });
                return channel.send({ content: `✅ O ticket foi assumido por <@${user.id}>!` });
            }

            // --- BOTÃO: FECHAR ---
            if (interaction.isButton() && cid === "close_ticket") {
                await interaction.reply({ content: "📂 A gerar transcrição..." });
                await sendTranscript(channel, user.tag);
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

            // --- ABRIR TICKET ---
            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid.startsWith("pagamento_"))) {
                if (!config.CATEGORY_ID) return interaction.reply({ content: "❌ Categoria não configurada.", flags: [MessageFlags.Ephemeral] });

                const metodo = interaction.values[0];
                await interaction.update({ content: "⏳ A abrir ticket...", embeds: [], components: [] });

                const canal = await guild.channels.create({
                    name: `ticket-${metodo}-${user.username}`,
                    parent: config.CATEGORY_ID,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...(config.STAFF_ROLES || []).map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const linkBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel("Ir para o Ticket").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${canal.id}`)
                );
                await interaction.followUp({ content: `✅ Ticket: <#${canal.id}>`, components: [linkBtn], flags: [MessageFlags.Ephemeral] });

                const embedT = new EmbedBuilder()
                    .setTitle("Suporte Jordan Shop")
                    .setDescription(`💳 **Método:** ${metodo} ✅`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡️ Reivindicar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await canal.send({ content: `<@${user.id}>`, embeds: [embedT], components: [btns] });
            }

        } catch (err) {
            console.error("Erro na interação:", err);
        }
    });
};
