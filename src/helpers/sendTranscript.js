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

        // CORREÇÃO: Nome simples para a rota do index.js encontrar facilmente
        const fileName = `${channel.id}.html`;
        const filePath = `transcripts/${fileName}`; 

        // 2. Envia para o bucket do Supabase
        const { error: storageError } = await supabase.storage
            .from('transcripts') 
            .upload(filePath, attachment.attachment, {
                contentType: 'text/html',
                upsert: true // Se o ticket for reaberto e fechado, ele atualiza o log
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
            // O link aponta para a tua ponte no Render
            .setDescription(`🔗 **Ver Online:** [Clique Aqui](https://jordan-shop.onrender.com/transcripts/${channel.id})`)
            .setFooter({ text: "Jordan Shop | Transcript" })
            .setTimestamp();
        
        // 4. Enviar para o canal de logs
        const logChannel = await channel.guild.channels.fetch("1424461544317517854").catch(() => null);
        
        if (logChannel) {
            await logChannel.send({ 
                embeds: [logEmbed], 
                files: [attachment] // Mantém o anexo para backup direto no Discord
            });
        }

        console.log(`✅ Transcript de ${channel.name} processado com sucesso.`);
        return filePath;

    } catch (err) {
        console.error("❌ Erro crítico no sendTranscript:", err.message);
    }
}

module.exports = sendTranscript;
