const supabase = require('../../database/supabase'); 
const discordTranscripts = require('discord-html-transcripts');
const { EmbedBuilder } = require('discord.js');

async function sendTranscript(channel, userName) {
    try {
        // 1. Gera o ficheiro HTML das mensagens
        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1, 
            filename: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        // Nome simples para o Supabase encontrar
        const fileName = `${channel.id}.html`;
        const filePath = `transcripts/${fileName}`; 

        // 2. Envia para o storage do Supabase
        const { error: storageError } = await supabase.storage
            .from('transcripts') 
            .upload(filePath, attachment.attachment, {
                contentType: 'text/html',
                upsert: true 
            });

        if (storageError) console.error("⚠️ Erro Supabase Storage:", storageError.message);

        // 3. Criar o Embed de log para o Discord
        const logEmbed = new EmbedBuilder()
            .setTitle("📄 Transcrição Arquivada")
            .setColor("#ff0000")
            .addFields(
                { name: "Canal:", value: `\`${channel.name}\``, inline: true },
                { name: "Fechado por:", value: `\`${userName}\``, inline: true }
            )
            .setDescription(`🔗 **Ver Online:** [Clique Aqui](https://jordan-shop.onrender.com/transcripts/${channel.id})`)
            .setFooter({ text: "Jordan Shop | Transcript" })
            .setTimestamp();
        
        // 4. Envia para o teu canal de logs específico
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
    }
}

module.exports = sendTranscript;
