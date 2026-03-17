const discordTranscripts = require("discord-html-transcripts");
const axios = require("axios");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config"); // Importar para usar o LOG_CHANNEL_ID se necessário

/**
 * Envia o transcript para o GitHub e para o canal de logs do Discord.
 */
module.exports = async function sendTranscript(channel, closedByTag) {
  try {
    // Variáveis de Ambiente (Garante que o GITHUB_TOKEN está no Render!)
    const { GITHUB_TOKEN } = process.env;
    const REPO = "arte-trimbauser/Jordan.Shop-Bot-Site"; 
    
    // Usamos o ID do config ou do Process
    const logId = process.env.TRANSCRIPT_LOG_CHANNEL_ID || config.LOG_CHANNEL_ID;
    const transChannel = await channel.client.channels.fetch(logId).catch(() => null);

    // 1. Gerar o Transcript (Visual oficial do Discord)
    const transcriptBuffer = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnBuffer: true,
      saveImages: true,
      poweredBy: false,
      filename: `ticket-${channel.name}.html`
    });

    // Limpar o nome: remove espaços, carateres especiais e garante que termina em .html
    const nomeFicheiro = `ticket-${channel.name}`
      .replace(/[^a-zA-Z0-9-]/g, '_')
      .toLowerCase() + ".html";
      
    const conteudoBase64 = transcriptBuffer.toString('base64');

    // 2. Upload para o GitHub (Pasta transcripts/)
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
      console.log(`[GITHUB] Log ${nomeFicheiro} guardado.`);
    } catch (apiErr) {
      // Se o erro for 422, é porque o ficheiro já existe (duplicado)
      if (apiErr.response?.status !== 422) {
        console.error(" [ERRO GITHUB]:", apiErr.message);
      }
    }

    // 3. Enviar para o Canal de Logs no Discord
    if (transChannel) {
      const logUrl = `https://discord-bott-jordan.onrender.com/transcripts/${nomeFicheiro}`;
      
      const embed = new EmbedBuilder()
        .setTitle("📄 Transcrição Arquivada")
        .addFields(
          { name: "Canal:", value: `\`${channel.name}\``, inline: true },
          { name: "Fechado por:", value: `\`${closedByTag}\``, inline: true }
        )
        .setColor("#ff0000") // Vermelho como pediste
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver no Navegador")
          .setURL(logUrl)
          .setStyle(ButtonStyle.Link)
      );

      await transChannel.send({ 
        embeds: [embed], 
        components: [row],
        // Mantemos o ficheiro em anexo para segurança extra
        files: [{ attachment: transcriptBuffer, name: nomeFicheiro }] 
      });
    }
  } catch (err) {
    console.error(" [ERRO TRANSCRIPT] Erro crítico:", err);
  }
};
