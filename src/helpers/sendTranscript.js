// Jordan.Shop-Bot.Discord/src/helpers/sendTranscript.js

const discordTranscripts = require("discord-html-transcripts");
const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = async function sendTranscript(channel, closedByTag) {
  try {
    const { TRANSCRIPT_LOG_CHANNEL_ID } = process.env;
    const transChannel = await channel.client.channels.fetch(TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);
    
    // AJUSTE: Pasta na raiz do projeto para o site encontrar facilmente
    const pastaTranscripts = path.join(__dirname, "../../transcripts");

    if (!fs.existsSync(pastaTranscripts)) {
      fs.mkdirSync(pastaTranscripts, { recursive: true });
    }

    const transcriptBuffer = await discordTranscripts.createTranscript(channel, {
      limit: -1, 
      returnBuffer: true, 
      saveImages: true, 
      poweredBy: false,
      filename: `ticket-${channel.name}.html`
    });

    const nomeFicheiro = `ticket-${channel.name}.html`.replace(/\s+/g, '_');
    const caminhoFinal = path.join(pastaTranscripts, nomeFicheiro);
    
    // Grava o ficheiro no disco do Render
    fs.writeFileSync(caminhoFinal, transcriptBuffer);

    if (transChannel) {
      const embed = new EmbedBuilder()
        .setTitle("📄 Novo Transcript")
        .setDescription(`**Ticket:** \`${channel.name}\`\n**Staff:** \`${closedByTag}\``)
        .setColor("#b00000")
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver no Site")
          .setURL(`https://jordan-shop-site.onrender.com/view-transcript/${nomeFicheiro}`)
          .setStyle(ButtonStyle.Link)
      );

      await transChannel.send({ 
        embeds: [embed], 
        components: [row], 
        files: [{ attachment: transcriptBuffer, name: nomeFicheiro }] 
      });
    }
  } catch (err) { console.error("Erro ao gerar transcript:", err); }
};
