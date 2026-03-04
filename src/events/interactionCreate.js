const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags } = require("discord.js");
const discordTranscripts = require("discord-html-transcripts");
const path = require("path");
const fs = require("fs");

async function saveLog(channel) {
    try {
        const pasta = path.resolve(__dirname, "../../transcripts");
        if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

        const transcript = await discordTranscripts.createTranscript(channel, {
            limit: -1, 
            filename: `ticket-${channel.name}.html`, 
            saveImages: true,
            poweredBy: false
        });

        const nomeFicheiro = `ticket-${channel.name}.html`.replace(/\s+/g, '_');
        fs.writeFileSync(path.join(pasta, nomeFicheiro), transcript.attachment);
        console.log(`✅ Log guardado em: ${path.join(pasta, nomeFicheiro)}`);
        return nomeFicheiro;
    } catch (e) {
        console.error("❌ Erro ao salvar log:", e);
        return null;
    }
}

module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        try {
            const { channel, user, customId: cid } = interaction;

            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const item = interaction.values[0];
                const btn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_${item}`).setLabel("Confirmar Abertura").setStyle(ButtonStyle.Success)
                );
                return interaction.reply({ content: `Abrir ticket para ${item}?`, components: [btn], flags: [MessageFlags.Ephemeral] });
            }

            if (interaction.isButton() && cid.startsWith("confirm_")) {
                const tipo = cid.replace("confirm_", "");
                await interaction.update({ content: "⏳ A criar canal...", components: [], flags: [MessageFlags.Ephemeral] });

                const canal = await interaction.guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    type: 0,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                const closeBtn = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("close_now").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger)
                );
                await canal.send({ content: `✅ Ticket de **${tipo.toUpperCase()}** aberto!`, components: [closeBtn] });
            }

            if (interaction.isButton() && cid === "close_now") {
                // Resolve o erro Unknown Interaction dando tempo ao bot
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                
                const nomeFicheiro = await saveLog(channel);
                
                if (nomeFicheiro) {
                    await interaction.editReply(`✅ Log arquivado! Podes ver no site em breve.`);
                } else {
                    await interaction.editReply(`⚠️ Erro ao salvar log, mas o canal será fechado.`);
                }

                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }
        } catch (err) {
            console.error("Erro na interação:", err);
        }
    });
};
