const { Buffer } = require("node:buffer");
const discordTranscripts = require("discord-html-transcripts");
const { TRANSCRIPT_LOG_CHANNEL_ID } = process.env;

module.exports = async function sendTranscript(channel, closedByTag, format = "txt") {
  try {
    const transChannel = await channel.client.channels.fetch(TRANSCRIPT_LOG_CHANNEL_ID).catch(()=>null);
    if (!transChannel) return;

    if (format === "html") {
      const attachment = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        returnBuffer: true,
        filename: `${channel.name}.html`,
        saveImages: true,
        poweredBy: false,
        footerText: `Ticket fechado por ${closedByTag}`
      });
      await transChannel.send({ content: `📄 Transcrição HTML do ticket ${channel.name} (fechado por ${closedByTag})`, files:[{attachment, name:`${channel.name}.html`}]}).catch(()=>{});
      return;
    }

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
    const arr = Array.from(messages.values()).reverse();
    const transcript = arr.map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || "<sem texto>"}`).join("\n");
    const buf = Buffer.from(transcript, "utf-8");
    await transChannel.send({ content: `📄 Transcrição TXT do ticket ${channel.name} (fechado por ${closedByTag})`, files:[{attachment:buf, name:`${channel.name}.txt`}]}).catch(()=>{});

  } catch (err) {
    console.error("Erro a enviar transcrição:", err);
  }
};
