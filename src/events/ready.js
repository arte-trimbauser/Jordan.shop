const { EmbedBuilder, ActivityType } = require("discord.js");

module.exports = async (client) => {
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");
    console.log(`✅ Sistema Jordan Shop Online!`);
    console.log(`🌐 Site: https://jordan-shop.onrender.com/`);
    console.log(`✅ Bot online como: ${client.user.tag}`);
    console.log(`🕒 Hora de Portugal: ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}`);
    console.log("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯");

    // ==================== REGISTAR SLASH COMMANDS ====================
    console.log("🔄 A registar slash commands...");

    const commands = [
        require("../commands/adicionar"),
        require("../commands/carrinho")
    ].filter(Boolean);

    try {
        // Registo global
        await client.application.commands.set(commands.map(cmd => cmd.data.toJSON()));
        console.log(`✅ ${commands.length} comandos slash registados globalmente!`);

        // Registo rápido no teu servidor (para aparecer imediatamente)
        const testGuild = client.guilds.cache.get("1393629457599828040"); // ID do teu servidor
        if (testGuild) {
            await testGuild.commands.set(commands.map(cmd => cmd.data.toJSON()));
            console.log(`✅ Comandos registados rapidamente no servidor! (deve aparecer em poucos segundos)`);
        }
    } catch (err) {
        console.error("❌ Erro ao registar slash commands:", err);
    }

    // ==================== STATUS ROTATIVO ====================
    const statusList = [
        { name: "Jordan Shop | discord.gg/6hhZeqb7Qk", type: ActivityType.Competing },
        { name: "Os melhores preços!", type: ActivityType.Watching },
        { name: "Jordan Shop #100", type: ActivityType.Listening },
        { name: "MELHOR LOJA DE CHEATS DE PORTUGAL!!!", type: ActivityType.Playing }
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
                .setDescription(`O bot foi iniciado com sucesso e está pronto para uso.\n\n🕒 **Hora:** ${agora}`)
                .setColor("#00ff00")
                .setFooter({ text: "Jordan Shop System", iconURL: client.user.displayAvatarURL() });

            await logChannel.send({ embeds: [embedLog] });
        }
    } catch (err) {
        console.error("Erro ao enviar log de inicialização no Discord.");
    }
};
