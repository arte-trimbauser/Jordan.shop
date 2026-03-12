module.exports = (client) => {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;
        console.log(`Interação recebida: ${interaction.customId}`);
        
        try {
            // Teste básico
            if (interaction.customId === "close_ticket") {
                await interaction.reply({ content: "Teste: Botão funciona!", ephemeral: true });
            }
        } catch (err) {
            console.error(err);
        }
    });
};
