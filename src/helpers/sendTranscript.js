const { Buffer } = require("node:buffer");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { TRANSCRIPT_LOG_CHANNEL_ID } = process.env;

module.exports = async function sendTranscript(channel, closedByTag, format = "html") {
  try {
    const transChannel = await channel.client.channels.fetch(TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);
    // Caminho para a pasta de transcripts no teu servidor Render
    const pastaTranscripts = path.join(__dirname, "../../transcripts");

    if (!fs.existsSync(pastaTranscripts)) {
      fs.mkdirSync(pastaTranscripts, { recursive: true });
    }

    if (format === "html") {
      const transcriptBuffer = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        returnBuffer: true,
        saveImages: true,
        poweredBy: false,
        footerText: `Jordan Shop - Fechado por ${closedByTag}`
      });

      // Nome do ficheiro limpo para o link não quebrar
      const nomeFicheiro = `ticket-${channel.name}-${closedByTag}.html`.replace(/\s+/g, '_');
      fs.writeFileSync(path.join(pastaTranscripts, nomeFicheiro), transcriptBuffer);

      if (transChannel) {
        const embed = new EmbedBuilder()
          .setTitle("📄 Nova Transcrição Disponível")
          .setDescription(`**Ticket:** \`${channel.name}\`\n**Fechado por:** \`${closedByTag}\``)
          .setColor("#b00000");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Ver no Painel Web")
            .setURL(`https://jordan-shop-site.onrender.com/transcripts/${nomeFicheiro}`)
            .setStyle(ButtonStyle.Link)
        );

        await transChannel.send({ embeds: [embed], components: [row], files: [{ attachment: transcriptBuffer, name: nomeFicheiro }] });
      }
      return;
    }
  } catch (err) {
    console.error("Erro no bot:", err);
  }
};
