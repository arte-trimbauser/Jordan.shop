const discordTranscripts = require("discord-html-transcripts");
const axios = require("axios");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const fs = require("fs");
const path = require("path");

module.exports = async function sendTranscript(channel, closedByTag) {
  try {
    const { GITHUB_TOKEN } = process.env;
    const REPO = "arte-trimbauser/Jordan.Shop-Bot-Site"; 

    const logId = process.env.TRANSCRIPT_LOG_CHANNEL_ID || config.LOG_CHANNEL_ID;
    const transChannel = await channel.client.channels.fetch(logId).catch(() => null);

    // ✅ 1. GERAR TRANSCRIPT
    const transcriptBuffer = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnBuffer: true,
      saveImages: true,
      poweredBy: false,
      filename: `ticket-${channel.name}.html`
    });

    // ✅ 2. NOME LIMPO
    const nomeFicheiro = `ticket-${channel.name}`
      .replace(/[^a-zA-Z0-9-]/g, '_')
      .toLowerCase() + ".html";

    const conteudoBase64 = transcriptBuffer.toString('base64');

    // ✅ 3. GUARDAR LOCAL (IMPORTANTE PARA O SITE FUNCIONAR)
    const localPath = path.join(__dirname, "..", "..", "site", "transcripts", nomeFicheiro);
    fs.writeFileSync(localPath, transcriptBuffer);

    // ✅ 4. UPLOAD PARA GITHUB (COM UPDATE SE JÁ EXISTIR)
    try {
      let sha = null;

      // Verifica se já existe
      try {
        const res = await axios.get(`https://api.github.com/repos/${REPO}/contents/transcripts/${nomeFicheiro}`, {
          headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        sha = res.data.sha;
      } catch {}

      await axios.put(`https://api.github.com/repos/${REPO}/contents/transcripts/${nomeFicheiro}`, {
        message: `Log de Ticket: ${channel.name} por ${closedByTag}`,
        content: conteudoBase64,
        ...(sha && { sha }) // 🔥 atualiza se existir
      }, {
        headers: { 
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      console.log(`[GITHUB] Log ${nomeFicheiro} guardado/atualizado.`);
    } catch (apiErr) {
      console.error(" [ERRO GITHUB]:", apiErr.message);
    }

    // ✅ 5. ENVIAR PARA DISCORD (COM BOTÃO)
    if (transChannel) {
      const logUrl = `https://discord-bott-jordan.onrender.com/transcripts/${nomeFicheiro}`;
      
      const embed = new EmbedBuilder()
        .setTitle("📄 Transcrição Arquivada")
        .addFields(
          { name: "Canal:", value: `\`${channel.name}\``, inline: true },
          { name: "Fechado por:", value: `\`${closedByTag}\``, inline: true }
        )
        .setColor("#ff0000")
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("📂 Ver Transcript")
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
    console.error(" [ERRO TRANSCRIPT] Erro crítico:", err);
  }
};
