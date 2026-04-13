const { EmbedBuilder, ActivityType, REST, Routes } = require("discord.js");
const { registrarComandoChamar } = require('../commands/chamarCommand');

module.exports = async (client) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Site: https://jordan-shop.onrender.com/`);
    console.log(`✅ Bot online como: ${client.user.tag}`);
    console.log(`🕒 Hora de Portugal: ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    // ==================== REGISTAR SLASH COMMANDS ====================
    console.log("🔄 A registar slash commands...");

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    try {
        const adicionar = require("../commands/adicionar");
        const carrinho = require("../commands/carrinho");
        const commands = [adicionar, carrinho].filter(Boolean).map(cmd => cmd.data.toJSON());

        // Limpa globais primeiro (evita duplicados)
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });

        // Regista só no servidor (mais rápido e sem duplicados)
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, "1393629457599828040"),
            { body: commands }
        );

        console.log(`✅ ${commands.length} comandos registados no servidor com sucesso!`);
    } catch (err) {
        console.error("❌ Erro ao registar slash commands:", err);
    }

    // ==================== REGISTAR COMANDO /CHAMAR ====================
    console.log("📞 A registar comando /chamar...");
    try {
        await registrarComandoChamar(client);
        console.log("✅ Comando /chamar registado com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao registar /chamar:", err);
    }

    // ==================== STATUS ROTATIVO ====================
    const statusList = [
        { name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Competing },
        { name: "Os melhores preços!", type: ActivityType.Watching },
        { name: "Jordan Shop #100", type: ActivityType.Listening },
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

    // ==================== LOG DE INICIALIZAÇÃO ====================
    const LOG_ID = process.env.LOG_CHANNEL_ID || "1437076921627181228";

    try {
        const logChannel = await client.channels.fetch(LOG_ID).catch(() => null);
        if (logChannel) {
            const agora = new Date().toLocaleTimeString('pt-PT', {
                timeZone: 'Europe/Lisbon',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const embedLog = new EmbedBuilder()
                .setTitle("✅ Bot está online!")
                .setDescription(`O bot foi iniciado com sucesso e está pronto para uso.\n\n🕒 **Hora:** ${agora}\n🌐 Site: https://jordan-shop.onrender.com/`)
                .setImage("https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp")
                .setThumbnail(client.user.displayAvatarURL())
                .setColor("#00ff00")
                .setFooter({ text: "Jordan Shop System", iconURL: client.user.displayAvatarURL() });
            await logChannel.send({ embeds: [embedLog] });
        }
    } catch (err) {
        console.error("Erro ao enviar log de inicialização no Discord.");
    }
};

// No final do ready.js, adicione:
const { 
    entrarCanalVoz, 
    enviarEmbedSuporte, 
    enviarFormularios 
} = require('./sistemaCompleto');

// Chamar quando o bot estiver pronto
await entrarCanalVoz(client);
await enviarEmbedSuporte(client);
await enviarFormularios(client);
