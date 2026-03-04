const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, StringSelectMenuBuilder } = require("discord.js");
const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");

async function sendTranscript(channel, userTag) {
    // IMPORTANTE: Caminho aponta para a pasta na raiz do projeto
    const pastaTranscripts = path.resolve(__dirname, "../../transcripts");
    
    if (!fs.existsSync(pastaTranscripts)) fs.mkdirSync(pastaTranscripts, { recursive: true });

    const attachment = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        filename: `ticket-${channel.name}.html`,
        saveImages: true,
        poweredBy: false
    });

    const nomeFicheiro = `ticket-${channel.name}.html`.replace(/\s+/g, '_');
    fs.writeFileSync(path.join(pastaTranscripts, nomeFicheiro), attachment.attachment);

    const logChannel = await channel.guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Ver no Site")
                .setURL(`https://jordan-shop-site.onrender.com/transcripts/${nomeFicheiro}`)
                .setStyle(ButtonStyle.Link)
        );
        await logChannel.send({ 
            content: `📄 Ticket: ${channel.name} | Fechado por: ${userTag}`, 
            components: [row], 
            files: [attachment] 
        });
    }
}

module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        const { channel, user, member, customId: cid } = interaction;
        if (!interaction.isButton()) return;

        if (cid === "close_ticket") {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("sale_no").setLabel("❌ Fechar Ticket").setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: "Confirmar fecho?", components: [row], ephemeral: true });
        }

        if (cid === "sale_no") {
            await interaction.update({ content: "📂 A gerar log...", components: [] });
            await sendTranscript(channel, user.tag);
            setTimeout(() => channel.delete(), 2000);
        }
    });
};
