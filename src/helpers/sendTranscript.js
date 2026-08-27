// src/helpers/sendTranscript.js
const supabase = require('../../database/supabase');
const { EmbedBuilder } = require('discord.js');

// Tenta carregar o módulo, se falhar usa fallback
let discordTranscripts;
try {
    discordTranscripts = require('discord-html-transcripts');
} catch (error) {
    console.warn('⚠️ discord-html-transcripts não encontrado. Usando fallback para transcrições.');
    discordTranscripts = null;
}

async function sendTranscript(channel, userName) {
    try {
        // Se o módulo não estiver disponível, usa fallback
        if (!discordTranscripts) {
            return await sendTranscriptFallback(channel, userName);
        }

        // Gera o ficheiro HTML das mensagens
        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            filename: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        // Nome simples para o Supabase encontrar
        const fileName = `${channel.id}.html`;
        const filePath = `transcripts/${fileName}`;

        // Envia para o Supabase
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
            // Continua mesmo com erro no Supabase
        }

        // Cria o Embed de log
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

        // Envia para o canal de logs
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
        console.error("❌ Erro no sendTranscript (principal):", err.message);
        // Se falhar, tenta o fallback
        try {
            return await sendTranscriptFallback(channel, userName);
        } catch (fallbackErr) {
            console.error("❌ Erro no fallback também:", fallbackErr.message);
            return null;
        }
    }
}

// Função de fallback para quando o módulo não funciona
async function sendTranscriptFallback(channel, userName) {
    console.log(`📝 Usando fallback para transcrição de ${channel.name}`);
    
    try {
        // Busca mensagens
        const messages = await channel.messages.fetch({ limit: 100 });
        const messagesArray = Array.from(messages.values()).reverse();
        
        // Cria texto simples
        let transcript = `=== TRANSCRIÇÃO DO TICKET ===\n`;
        transcript += `Canal: ${channel.name}\n`;
        transcript += `Utilizador: ${userName}\n`;
        transcript += `Data: ${new Date().toLocaleString()}\n`;
        transcript += `${'='.repeat(50)}\n\n`;
        
        for (const msg of messagesArray) {
            const timestamp = msg.createdAt.toLocaleString();
            const author = msg.author.tag;
            const content = msg.content || '[Embed ou Anexo]';
            transcript += `[${timestamp}] ${author}: ${content}\n`;
        }
        
        // Envia para o canal de logs
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
        
        console.log(`✅ Transcrição fallback guardada para ${channel.name}`);
        return true;
    } catch (error) {
        console.error('❌ Erro no fallback:', error.message);
        return false;
    }
}

module.exports = sendTranscript;
