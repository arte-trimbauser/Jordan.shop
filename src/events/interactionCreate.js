const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const config = require("../config");
const isStaff = require("../helpers/isStaff");
const sendCallDM = require("../helpers/sendCallDM");
const sendTranscript = require("../helpers/sendTranscript");

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

// IMPORTANTE: Sem 'async' aqui no module.exports
module.exports = (client) => {
    
    // O 'async' fica apenas aqui dentro
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.guild) return;

        const { channel, user, guild, customId: cid, member } = interaction;

        try {
            // --- CHAMAR STAFF ---
            if (interaction.isButton() && cid === "call_staff") {
                const isDev = config.DEV_IDS?.includes(user.id);
                const last = staffCooldown.get(user.id);

                if (!isDev && last && (Date.now() - last < STAFF_WAIT)) {
                    return interaction.reply({ content: `⏳ Aguarda o cooldown.`, flags: [MessageFlags.Ephemeral] });
                }

                const members = await guild.members.fetch({ withPresences: true });
                const staffList = members.filter(m => isStaff(m) && !m.user.bot);

                if (staffList.size === 0) return interaction.reply({ content: "❌ Sem staff online.", flags: [MessageFlags.Ephemeral] });

                const options = staffList.map(m => ({ label: m.displayName, value: m.id })).slice(0, 25);
                const menu = new StringSelectMenuBuilder().setCustomId("select_staff").setPlaceholder("Escolhe o Staff").addOptions(options);
                
                if (!isDev) staffCooldown.set(user.id, Date.now());
                return interaction.reply({ content: "Selecione o staff:", components: [new ActionRowBuilder().addComponents(menu)], flags: [MessageFlags.Ephemeral] });
            }

            // --- REIVINDICAR TICKET ---
            if (interaction.isButton() && cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "❌ Só staff!", flags: [MessageFlags.Ephemeral] });
                await interaction.update({ content: `✅ Assumido por <@${user.id}>`, components: [] });
            }

            // --- FECHAR TICKET ---
            if (interaction.isButton() && cid === "close_ticket") {
                await interaction.reply({ content: "📂 A gerar transcrição..." });
                await sendTranscript(channel, user.tag);
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

            // --- ABRIR TICKET ---
            if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid.startsWith("pagamento_"))) {
                if (!config.CATEGORY_ID) return interaction.reply({ content: "❌ Erro: CATEGORY_ID!", flags: [MessageFlags.Ephemeral] });

                const metodo = interaction.values[0];
                await interaction.update({ content: "⏳ A abrir ticket...", components: [] });

                const canal = await guild.channels.create({
                    name: `ticket-${metodo}-${user.username}`,
                    parent: config.CATEGORY_ID,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                await canal.send({ content: `Novo ticket de <@${user.id}> para ${metodo}` });
            }

        } catch (error) {
            console.error("Erro na interação:", error);
        }
    });
};
