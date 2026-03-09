const discordTranscripts = require("discord-html-transcripts");
const axios = require("axios");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

/**
 * Envia o transcript para o GitHub (armazenamento eterno) e para o canal de logs do Discord.
 * @param {import("discord.js").TextChannel} channel - O canal do ticket.
 * @param {string} closedByTag - Tag do staff que fechou o ticket.
 */
module.exports = async function sendTranscript(channel, closedByTag) {
  try {
    // Variáveis de Ambiente (Configura estas no Painel do Render!)
    const { TRANSCRIPT_LOG_CHANNEL_ID, GITHUB_TOKEN } = process.env;
    const REPO = "arte-trimbauser/Jordan.Shop-Bot-Site"; 
    
    const transChannel = await channel.client.channels.fetch(TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);

    // 1. Gerar o Transcript (Buffer de memória)
    const transcriptBuffer = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnBuffer: true,
      saveImages: true,
      poweredBy: false,
      filename: `ticket-${channel.name}.html`
    });

    // Limpar o nome do ficheiro (remover espaços e carateres estranhos)
    const nomeFicheiro = `ticket-${channel.name}.html`.replace(/\s+/g, '_').toLowerCase();
    const conteudoBase64 = transcriptBuffer.toString('base64');

    // 2. Upload para o GitHub (Pasta transcripts/)
    // Isso garante que o site Jordan Shop consiga listar o log gratuitamente
    try {
      await axios.put(`https://api.github.com/repos/${REPO}/contents/transcripts/${nomeFicheiro}`, {
        message: `Log de Ticket: ${channel.name} por ${closedByTag}`,
        content: conteudoBase64
      }, {
        headers: { 
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
      console.log(`[GITHUB] Log ${nomeFicheiro} guardado com sucesso.`);
    } catch (apiErr) {
      console.error(" [ERRO GITHUB] Não foi possível salvar o log online:", apiErr.response?.data || apiErr.message);
    }

    // 3. Enviar para o Canal de Logs no Discord
    if (transChannel) {
      // Link direto que aponta para o teu site no Render
      const logUrl = `https://discord-bott-jordan.onrender.com/transcripts/${nomeFicheiro}`;
      
      const embed = new EmbedBuilder()
        .setTitle("📄 Novo Transcript Gerado")
        .addFields(
          { name: "Ticket:", value: `\`${channel.name}\``, inline: true },
          { name: "Fechado por:", value: `\`${closedByTag}\``, inline: true },
          { name: "Link Web:", value: `[Abrir no Painel Staff](${logUrl})` }
        )
        .setColor("#8b0000")
        .setTimestamp()
        .setFooter({ text: "Jordan Shop System", iconURL: channel.guild.iconURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver no Navegador")
          .setURL(logUrl)
          .setStyle(ButtonStyle.Link)
      );

      await transChannel.send({ 
        embeds: [embed], 
        components: [row],
        files: [{ attachment: transcriptBuffer, name: nomeFicheiro }] 
      });
    }
  } catch (err) {
    console.error(" [ERRO TRANSCRIPT] Erro crítico ao gerar log:", err);
  }
};
