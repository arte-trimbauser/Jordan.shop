const { createClient } = require('@supabase/supabase-js');
const discordTranscripts = require('discord-html-transcripts');

// Configuração do Supabase (usa as tuas variáveis do .env)
const supabase = createClient(
    'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

async function sendTranscript(channel, userName) {
    try {
        // 1. Gera o transcript em formato de anexo (buffer)
        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1, // Puxa todas as mensagens
            fileName: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const fileName = `transcript-${channel.id}-${Date.now()}.html`;

        // 2. Faz o Upload para o Bucket 'transcripts' no Supabase
        const { data, error } = await supabase.storage
            .from('transcripts')
            .upload(fileName, attachment.attachment, {
                contentType: 'text/html',
                upsert: true
            });

        if (error) throw error;

        console.log(`✅ Transcript guardado no Supabase: ${fileName}`);
        return fileName;

    } catch (err) {
        console.error("❌ Erro ao gerar/enviar transcript:", err);
    }
}

module.exports = sendTranscript;
