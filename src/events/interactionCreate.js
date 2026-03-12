const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const config = require("../config");

// Importar os teus helpers
const isStaff = require("../helpers/isStaff");
const sendCallDM = require("../helpers/sendCallDM");
const sendTranscript = require("../helpers/sendTranscript");

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        const { channel, user, guild, customId: cid, member } = interaction;

        // --- BOTÃO: CHAMAR STAFF ---
        if (interaction.isButton() && cid === "call_staff") {
            const isDev = config.DEV_IDS.includes(user.id);
            const last = staffCooldown.get(user.id);

            if (!isDev && last && (Date.now() - last < STAFF_WAIT)) {
                const falta = Math.ceil((STAFF_WAIT - (Date.now() - last)) / 1000);
                return interaction.reply({ content: `⏳ Como não és developer, tens de esperar **${falta} segundos** para chamar de novo.`, flags: [MessageFlags.Ephemeral] });
            }

            // Ordenação: Cargo (Topo/Hierarquia) > Nome (ABC)
            const members = await guild.members.fetch({ withPresences: true });
            const staffList = members
                .filter(m => isStaff(m) && !m.user.bot)
                .sort((a, b) => {
                    const roleDiff = b.roles.highest.position - a.roles.highest.position;
                    if (roleDiff !== 0) return roleDiff;
                    return a.displayName.localeCompare(b.displayName);
                });

            if (staffList.size === 0) return interaction.reply({ content: "❌ Ninguém da staff online.", flags: [MessageFlags.Ephemeral] });

            const options = staffList.map(m => ({ 
                label: m.displayName, 
                value: m.id, 
                description: `Cargo: ${m.roles.highest.name}` 
            })).slice(0, 25);

            const menu = new StringSelectMenuBuilder().setCustomId("select_staff").setPlaceholder("Escolhe o Staff").addOptions(options);
            
            if (!isDev) staffCooldown.set(user.id, Date.now());
            
            return interaction.reply({ 
                content: isDev ? "⭐ Modo Developer: Sem cooldown." : "Selecione o staff que deseja notificar:", 
                components: [new ActionRowBuilder().addComponents(menu)], 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // --- SELEÇÃO DE STAFF (DM) ---
        if (interaction.isStringSelectMenu() && cid === "select_staff") {
            const staffId = interaction.values[0];
            await sendCallDM({ 
                toUserId: staffId, 
                fromUser: user, 
                channel: channel, 
                isStaffCall: isStaff(member) 
            });

            return interaction.update({ content: `✅ <@${staffId}> foi notificado por DM!`, components: [] });
        }

        // --- BOTÃO: REIVINDICAR (CLAIM) ---
        if (interaction.isButton() && cid === "claim_ticket") {
            if (!isStaff(member)) {
                return interaction.reply({ content: "❌ Apenas a staff pode reivindicar tickets!", flags: [MessageFlags.Ephemeral] });
            }

            const systemId = "1457415165380268134"; // ID que pediste

            const embedClaim = new EmbedBuilder()
                .setTitle("🛡️ Ticket Reivindicado")
                .setDescription(`O staff <@${user.id}> reivindicou este ticket.\n\n🆔 **ID do Sistema:** \`${systemId}\``)
                .setColor("#00ff00")
                .setTimestamp();

            // Desativar botão de claim
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡️ Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ components: [row] });
            return channel.send({ content: `✅ O ticket foi assumido por <@${user.id}>!`, embeds: [embedClaim] });
        }

        // --- BOTÃO: FECHAR TICKET ---
        if (interaction.isButton() && cid === "close_ticket") {
            await interaction.reply({ content: "📂 A gerar transcrição e a guardar no GitHub..." });
            await sendTranscript(channel, user.tag);
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }

        // --- ABRIR TICKET (Corrigido para o teu menu_ticket) ---
        if (interaction.isStringSelectMenu() && (cid === "menu_ticket" || cid.startsWith("pagamento_"))) {
            const metodo = interaction.values[0];
            
            // Impede o user de clicar no menu de seleção de staff como se fosse abrir ticket
            if (cid === "select_staff") return;

            await interaction.update({ content: "⏳ A abrir o teu ticket...", embeds: [], components: [] });

            const canal = await guild.channels.create({
                name: `ticket-${metodo}-${user.username}`,
                parent: config.CATEGORY_ID,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ...config.STAFF_ROLES.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                ]
            });

            const irParaTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel("Ir para o Ticket").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${canal.id}`)
            );
            
            await interaction.followUp({ content: `✅ Ticket criado: <#${canal.id}>`, components: [irParaTicket], flags: [MessageFlags.Ephemeral] });

            const embedTicket = new EmbedBuilder()
                .setTitle("obrigado(a) por criar um ticket, em breve algum staff te ajudara")
                .setDescription(`💳 **Método escolhido:** ${metodo} ✅`)
                .setColor("#2f3136");

            const botoesTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡️ Reivindicar").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("call_staff").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
            );

            await canal.send({ content: `<@${user.id}>`, embeds: [embedTicket], components: [botoesTicket] });
        }
    });
};
