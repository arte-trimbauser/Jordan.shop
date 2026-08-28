// src/helpers/sendTranscript.js
const supabase = require('../../database/supabase');
const { EmbedBuilder } = require('discord.js');

// Tenta carregar discord-html-transcripts, com fallback
let discordTranscripts;
try {
    discordTranscripts = require('discord-html-transcripts');
} catch (error) {
    console.warn('⚠️ discord-html-transcripts não encontrado. Usando fallback.');
    discordTranscripts = null;
}

// Determina o domínio para os links (prioriza Vercel)
const getBaseUrl = () => {
    // Se estiver no ambiente Vercel, usa a URL da Vercel
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    // Fallback fixo para o site na Vercel
    return 'https://jordan-shop-bot-site.vercel.app';
};

async function sendTranscript(channel, userName) {
    try {
        if (!discordTranscripts) {
            return await sendTranscriptFallback(channel, userName);
        }

        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            filename: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const fileName = `${channel.id}.html`;
        const filePath = `transcripts/${fileName}`;

        // Upload para Supabase
        const { error: storageError } = await supabase.storage
            .from('transcripts')
            .upload(filePath, attachment.attachment, {
                contentType: 'text/html',
                upsert: true,
                cacheControl: '3600',
                metadata: {
                    cliente: userName,
                    canal: channel.name
                }
            });

        if (storageError) {
            console.error("⚠️ Erro Supabase Storage:", storageError.message);
        }

        const baseUrl = getBaseUrl();
        const transcriptUrl = `${baseUrl}/transcripts/${channel.id}`;

        // Embed para o Discord
        const logEmbed = new EmbedBuilder()
            .setTitle("📄 Transcrição Arquivada")
            .setColor("#ff0000")
            .addFields(
                { name: "Canal:", value: `\`${channel.name}\``, inline: true },
                { name: "Fechado por:", value: `\`${userName}\``, inline: true }
            )
            .setDescription(`🔗 **Ver Online:** [Clique Aqui](${transcriptUrl})`)
            .setFooter({ text: "Jordan Shop | Transcript" })
            .setTimestamp();

        const logChannel = await channel.guild.channels.fetch("1424461544317517854").catch(() => null);
        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed],
                files: [attachment]
            });
        }

        console.log(`✅ Transcript de ${channel.name} guardado.`);
        return filePath;

    } catch (err) {
        console.error("❌ Erro no sendTranscript:", err.message);
        try {
            return await sendTranscriptFallback(channel, userName);
        } catch (fallbackErr) {
            console.error("❌ Erro no fallback:", fallbackErr.message);
            return null;
        }
    }
}

// Fallback (texto simples)
async function sendTranscriptFallback(channel, userName) {
    console.log(`📝 Fallback para ${channel.name}`);
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const messagesArray = Array.from(messages.values()).reverse();
        let transcript = `=== TRANSCRIÇÃO DO TICKET ===\nCanal: ${channel.name}\nUtilizador: ${userName}\nData: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;
        for (const msg of messagesArray) {
            transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content || '[Embed/Anexo]'}\n`;
        }

        const logChannel = await channel.guild.channels.fetch("1424461544317517854").catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`📄 Transcrição (Fallback): ${channel.name}`)
                .setDescription(`Ticket fechado por: ${userName}`)
                .setColor('#ff0000')
                .setTimestamp();
            await logChannel.send({
                embeds: [embed],
                files: [{
                    attachment: Buffer.from(transcript, 'utf-8'),
                    name: `transcript-${channel.name}-${Date.now()}.txt`
                }]
            });
        }
        console.log(`✅ Transcript fallback guardado para ${channel.name}`);
        return true;
    } catch (error) {
        console.error('❌ Erro no fallback:', error.message);
        return false;
    }
}

module.exports = sendTranscript;
