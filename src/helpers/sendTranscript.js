const supabase = require('../../database/supabase'); // Importa a tua config
const discordTranscripts = require('discord-html-transcripts');

async function sendTranscript(channel, userName) {
    try {
        // 1. Gera o ficheiro HTML das mensagens
        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1, 
            fileName: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const fileName = `transcripts/transcript-${channel.id}-${Date.now()}.html`;

        // 2. Envia para o balde (bucket) 'transcripts'
        const { data, error } = await supabase.storage
            .from('transcripts') // NOME DO TEU BUCKET NO SUPABASE
            .upload(fileName, attachment.attachment, {
                contentType: 'text/html',
                upsert: true
            });

        if (error) throw error;

        console.log(`✅ Log guardado com sucesso: ${fileName}`);
        return fileName;

    } catch (err) {
        console.error("❌ Erro ao processar transcript:", err.message);
    }
}

module.exports = sendTranscript;
