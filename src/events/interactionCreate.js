const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder 
} = require("discord.js");
const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");

// Função para gerar e guardar o log no site
async function sendTranscript(channel, userTag) {
    try {
        // Caminho absoluto para a pasta na raiz do projeto
        const pastaTranscripts = path.resolve(__dirname, "../../transcripts");
        
        if (!fs.existsSync(pastaTranscripts)) {
            fs.mkdirSync(pastaTranscripts, { recursive: true });
        }

        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            filename: `ticket-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const nomeFicheiro = `ticket-${channel.name}.html`.replace(/\s+/g, '_');
        const caminhoCompleto = path.join(pastaTranscripts, nomeFicheiro);
        
        fs.writeFileSync(caminhoCompleto, attachment.attachment);
        console.log(`✅ Log guardado em: ${caminhoCompleto}`);

        const logChannel = await channel.guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Ver no Site")
                    .setURL(`https://jordan-shop-site.onrender.com/transcripts/${nomeFicheiro}`)
                    .setStyle(ButtonStyle.Link)
            );
            await logChannel.send({ 
                content: `📄 Ticket: ${channel.name} | Fechado por: ${userTag}`, 
                components: [row], 
                files: [attachment] 
            });
        }
    } catch (err) {
        console.error("❌ Erro ao gerar transcript:", err);
    }
}

module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        try {
            const { channel, user, member, customId: cid } = interaction;

            // --- ABERTURA DE TICKET (O QUE ESTAVA A FALHAR) ---
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar Termos").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ content: "📜 Aceitas os termos da Jordan Shop?", components: [row], ephemeral: true });
            }

            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");
                await interaction.update({ content: "⏳ A criar o teu ticket...", components: [], ephemeral: true });
                
                let category = interaction.guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
                if (!category) category = await interaction.guild.channels.create({ name: config.CATEGORY_NAME, type: 4 });

                const canal = await interaction.guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`.toLowerCase(),
                    parent: category.id,
                    topic: user.id,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("❌ Fechar").setStyle(ButtonStyle.Danger)
                );
                await canal.send({ content: `✅ Ticket aberto para ${user}!\nProduto: **${tipo.toUpperCase()}**`, components: [row] });
                return interaction.editReply({ content: `Teu ticket: <#${canal.id}>` });
            }

            // --- FECHO DE TICKET ---
            if (interaction.isButton() && cid === "close_ticket") {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("confirm_close").setLabel("Confirmar Fecho").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ content: "Queres mesmo fechar este ticket?", components: [row], ephemeral: true });
            }

            if (interaction.isButton() && cid === "confirm_close") {
                await interaction.update({ content: "📂 A arquivar e a apagar...", components: [] });
                await sendTranscript(channel, user.tag);
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) {
            console.error("Erro na interação:", err);
        }
    });
};
