const supabase = require('../../database/supabase'); 
const discordTranscripts = require('discord-html-transcripts');
const { EmbedBuilder } = require('discord.js');

async function sendTranscript(channel, userName) {
    try {
        // 1. Gera o ficheiro HTML real das mensagens
        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1, 
            filename: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const filePath = `transcripts/transcript-${channel.id}-${Date.now()}.html`;

        // 2. Envia para o bucket do Supabase
        const { error: storageError } = await supabase.storage
            .from('transcripts') 
            .upload(filePath, attachment.attachment, {
                contentType: 'text/html',
                upsert: true
            });

        if (storageError) console.error("⚠️ Erro Supabase Storage:", storageError.message);

// 3. Criar o Embed para o Discord
        const logEmbed = new EmbedBuilder()
            .setTitle("📄 Transcrição Arquivada")
            .setColor("#ff0000")
            .addFields(
                { name: "Canal:", value: `\`${channel.name}\``, inline: true },
                { name: "Fechado por:", value: `\`${userName}\``, inline: true }
            )
            // IMPORTANTE: O link agora aponta para a nossa nova rota usando o ID do canal
            .setDescription(`🔗 **Ver Online:** [Clique Aqui](https://jordan-shop.onrender.com/transcripts/${channel.id})`)
            .setFooter({ text: "Jordan Shop | Transcript" })
            .setTimestamp();
        
        // 4. Enviar para o canal de logs (ID que pediste)
        const logChannel = await channel.guild.channels.fetch("1424461544317517854").catch(() => null);
        
        if (logChannel) {
            await logChannel.send({ 
                embeds: [logEmbed], 
                files: [attachment] // Isto faz aparecer o retângulo de download (8KB)
            });
        }

        console.log(`✅ Transcript de ${channel.name} processado com sucesso.`);
        return filePath;

    } catch (err) {
        console.error("❌ Erro crítico no sendTranscript:", err.message);
    }
}

module.exports = sendTranscript;
