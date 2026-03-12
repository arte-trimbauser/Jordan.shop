const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const config = require("../config");

// Helpers
const isStaff = require("../helpers/isStaff");
const sendCallDM = require("../helpers/sendCallDM");
const sendTranscript = require("../helpers/sendTranscript");

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

// REMOVIDO O ASYNC DAQUI PARA EVITAR ERRO DE TOP LEVEL
module.exports = (client) => {
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
                    const msgTempo = minutos > 0 ? `**${minutos}m e ${segundos}s**` : `**${segundos}s**`;
                    return interaction.reply({ content: `⏳ Aguarda ${msgTempo}.`, flags: [MessageFlags.Ephemeral] });
                }

                const members = await guild.members.fetch({ withPresences: true });
                const staffList = members.filter(m => isStaff(m) && !m.user.bot);

                if (staffList.size === 0) return interaction.reply({ content: "❌ Sem staff online.", flags: [MessageFlags.Ephemeral] });

                const options = staffList.map(m => ({ label: m.displayName, value: m.id })).slice(0, 25);
                const menu = new StringSelectMenuBuilder().setCustomId("select_staff").setPlaceholder("Escolhe o Staff").addOptions(options);
                
                if (!isDev) staffCooldown.set(user.id, Date.now());
                return interaction.reply({ content: "Selecione o staff:", components: [new ActionRowBuilder().addComponents(menu)], flags: [MessageFlags.Ephemeral] });
            }

            // --- ABRIR TICKET ---
            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid.startsWith("pagamento_"))) {
                if (!config.CATEGORY_ID) return interaction.reply({ content: "❌ CATEGORY_ID em falta no config.", flags: [MessageFlags.Ephemeral] });

                const metodo = interaction.values[0];
                await interaction.update({ content: "⏳ A gerar ticket...", embeds: [], components: [] });

                const canal = await guild.channels.create({
                    name: `ticket-${metodo}-${user.username}`,
                    parent: config.CATEGORY_ID,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...(config.STAFF_ROLES || []).map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const rowLink = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel("Ir para o Ticket").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${canal.id}`)
                );
                
                await interaction.followUp({ content: `✅ Canal: <#${canal.id}>`, components: [rowLink], flags: [MessageFlags.Ephemeral] });

                const embed = new EmbedBuilder().setTitle("Suporte Jordan Shop").setDescription(`Método: ${metodo}`).setColor("#2f3136");
                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡️ Reivindicar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await canal.send({ content: `<@${user.id}>`, embeds: [embed], components: [btns] });
            }

            // --- REIVINDICAR ---
            if (interaction.isButton() && cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "❌ Só staff!", flags: [MessageFlags.Ephemeral] });
                await interaction.update({ content: `✅ Ticket assumido por <@${user.id}>`, components: [] });
            }

            // --- FECHAR ---
            if (interaction.isButton() && cid === "close_ticket") {
                await interaction.reply({ content: "📂 A fechar..." });
                await sendTranscript(channel, user.tag);
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

        } catch (error) {
            console.error("Erro:", error);
        }
    });
};
