// src/events/ready.js
const { EmbedBuilder, ActivityType, REST, Routes } = require("discord.js");
const { registrarComandoChamar } = require('../commands/chamarCommand');
const { comandoVerificacao } = require('./sistemaVerificacao');

const {
    entrarCanalVoz,
    enviarEmbedSuporte,
    enviarFormularios,
    registrarComandosVoz,
    inicializarNotificacaoTickets,
    iniciarMonitorizacaoInatividadeTickets
} = require('./sistemaCompleto');

const {
    enviarVerificacao,
    inicializarSistemaVerificacao
} = require('./sistemaVerificacao');

module.exports = async (client) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Site: https://jordan-shop-bot-site.vercel.app/`);
    console.log(`✅ Bot online como: ${client.user.tag}`);
    console.log(`🕒 Hora de Portugal: ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    try {
        const adicionar = require("../commands/adicionar");
        const carrinho = require("../commands/carrinho");
        const commands = [
            adicionar.data.toJSON(),
            carrinho.data.toJSON(),
            comandoVerificacao.toJSON()
        ];

        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, "1393629457599828040"),
            { body: commands }
        );
        console.log(`✅ ${commands.length} comandos registados no servidor com sucesso!`);
    } catch (err) {
        console.error("❌ Erro ao registar slash commands:", err);
    }

    try {
        await registrarComandosVoz(client);
        console.log("✅ Comandos de voz registados com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao registar comandos de voz:", err);
    }

    try {
        await registrarComandoChamar(client);
        console.log("✅ Comando /chamar registado com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao registar /chamar:", err);
    }

    try {
        await entrarCanalVoz(client);
        await enviarEmbedSuporte(client);
        await enviarFormularios(client);
        console.log("✅ Sistemas adicionais inicializados!");
    } catch (err) {
        console.error("❌ Erro ao inicializar sistemas adicionais:", err);
    }

    try {
        await enviarVerificacao(client);
        inicializarSistemaVerificacao(client);
        console.log("✅ Sistema de verificacao inicializado!");
    } catch (err) {
        console.error("❌ Erro ao inicializar verificacao:", err);
    }

    try {
        inicializarNotificacaoTickets(client);
        iniciarMonitorizacaoInatividadeTickets(client);
        console.log("✅ Sistema de notificação de tickets e inatividade inicializado!");
    } catch (err) {
        console.error("❌ Erro ao inicializar notificação:", err);
    }

    const statusList = [
        { name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Competing },
        { name: "Os melhores precos!", type: ActivityType.Watching },
        { name: "Jordan Shop #150", type: ActivityType.Listening },
        { name: "MELHOR LOJA DE CHE4TS DE PORTUGAL!!!", type: ActivityType.Playing }
    ];
    let i = 0;
    const updateStatus = () => {
        client.user.setPresence({
            activities: [statusList[i]],
            status: "online"
        });
        i = (i + 1) % statusList.length;
    };
    updateStatus();
    setInterval(updateStatus, 5000);

    const LOG_ID = "1437076921627181228";
    try {
        const logChannel = await client.channels.fetch(LOG_ID).catch(() => null);
        if (logChannel) {
            const agora = new Date().toLocaleTimeString('pt-PT', {
                timeZone: 'Europe/Lisbon',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const horaNum = parseInt(agora.split(':')[0]);

            let titulo = "✅ Bot está online!";
            let descricao =
                `O bot foi iniciado com sucesso e está pronto para uso.\n\n` +
                `🕒 **Hora:** ${agora}\n` +
                `🌐 **Site:** https://jordan-shop-bot-site.vercel.app/\n\n` +
                `🔄 **Motivo:** Reinício ou deploy manual.`;

            if (horaNum >= 8 && horaNum <= 11) {
                titulo = "☀️ Bom dia! O bot está online!";
                descricao =
                    `O bot acordou e está pronto para trabalhar durante o dia.\n\n` +
                    `🕒 **Hora:** ${agora}\n` +
                    `🌐 **Site:** https://jordan-shop-bot-site.vercel.app/\n\n` +
                    `🔄 **Estado:** Operacional. Volta a dormir às 3:00 da manhã.`;
            } else if (horaNum >= 0 && horaNum <= 5) {
                titulo = "🌙 Boa noite! O bot vai descansar.";
                descricao =
                    `O bot está a encerrar as atividades e vai dormir até às 10:00.\n\n` +
                    `🕒 **Hora:** ${agora}\n` +
                    `🌐 **Site:** https://jordan-shop-bot-site.vercel.app/\n\n` +
                    `😴 **Estado:** A suspender serviço. Até amanhã!`;
            }

            const embedLog = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(descricao)
                .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp")
                .setThumbnail(client.user.displayAvatarURL())
                .setColor("#00ff00")
                .setFooter({ text: "Jordan Shop System", iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            await logChannel.send({ embeds: [embedLog] });
        }
    } catch (err) {
        console.error("❌ Erro ao enviar log de inicializacao no Discord.");
    }
};
