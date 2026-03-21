const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, ModalBuilder, 
    TextInputBuilder, TextInputStyle, ChannelType
} = require("discord.js");
const config = require("../config");
const menus = require("../menus");
const discordTranscripts = require("discord-html-transcripts");
const OpenAI = require('openai');

const supabase = require("../../supabase");

// --- Configuração OpenAI ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map();
const MAX_HISTORY = 6;
const SYSTEM_PROMPT = `És um assistente inteligente no Discord (Jordan Shop). Respondes em PT-PT.`;


// ================= TRANSCRIPT =================
async function sendTranscript(channel, userTag) {
    try {
        const logChannel = await channel.guild.channels
            .fetch(config.TRANSCRIPT_LOG_CHANNEL_ID)
            .catch(() => null);

        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            filename: `ticket-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const nomeFicheiro = `ticket-${channel.name}.html`
            .replace(/\s+/g, '_')
            .toLowerCase();

        const { error } = await supabase.storage
            .from('transcripts')
            .upload(nomeFicheiro, attachment.attachment, {
                contentType: 'text/html',
                upsert: true
            });

        if (error) return console.error(error);

        const { data } = supabase.storage
            .from('transcripts')
            .getPublicUrl(nomeFicheiro);

        const link = data.publicUrl;

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("📄 Transcrição Arquivada")
                .setDescription(`**Canal:** \`${channel.name}\`\n**Fechado por:** \`${userTag}\``)
                .setColor("#b00000");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Ver no Painel Web")
                    .setURL(link)
                    .setStyle(ButtonStyle.Link)
            );

            await logChannel.send({
                embeds: [embed],
                components: [row]
            });
        }

    } catch (err) {
        console.error("Erro transcript:", err);
    }
}

// ================= CORE =================
module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        try {

            /* CHAT AI */
            if (interaction.isChatInputCommand() && interaction.commandName === 'chat') {
                const userPrompt = interaction.options.getString('mensagem');
                await interaction.deferReply();

                if (!memory.has(interaction.user.id)) memory.set(interaction.user.id, []);
                const history = memory.get(interaction.user.id);

                history.push({ role: 'user', content: userPrompt });

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history]
                });

                const reply = completion.choices[0].message.content;
                history.push({ role: 'assistant', content: reply });

                return interaction.editReply(reply);
            }

            /* MENU TICKET */
            if (interaction.isStringSelectMenu() && interaction.customId === "menu_ticket") {
                const tipo = interaction.values[0];

                const termosEmbed = new EmbedBuilder()
                    .setTitle("📜 Termos de Serviço")
                    .setDescription(`
🔁 **Termos de Serviço de Reembolso**
Não oferecemos reembolsos após a conclusão de uma compra ou serviço.

🔄 **Termos de Serviço de Substituição**
A substituição só é possível com um voucher.
Sem voucher = sem garantia ou substituição.

👤 **Termos de Serviço da Conta**
Altere e-mail e senha imediatamente. Não nos responsabilizamos após a entrega.

💸 **Termos de Serviço do PayPal**
Pagamentos via "Amigos e Familiares" – sem mensagem.

🌐 **Idioma do Ticket**
Suporte apenas em Português.

**Atenciosamente, Jordan.**`)
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`aceitar_termos_${tipo}`)
                        .setLabel("Aceitar")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId("recusar_termos")
                        .setLabel("Recusar")
                        .setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ embeds: [termosEmbed], components: [row], ephemeral: true });
            }

            /* CRIAR TICKET */
            if (interaction.isButton() && interaction.customId.startsWith("aceitar_termos_")) {

                const tipo = interaction.customId.replace("aceitar_termos_", "");
                await interaction.update({ content: "⏳ A criar seu ticket/pedido...", embeds: [], components: [] });

                let category = interaction.guild.channels.cache.find(
                    c => c.name === config.CATEGORY_NAME && c.type === ChannelType.GuildCategory
                );

                if (!category) {
                    category = await interaction.guild.channels.create({
                        name: config.CATEGORY_NAME,
                        type: ChannelType.GuildCategory
                    });
                }

                const canal = await interaction.guild.channels.create({
                    name: `ticket-${tipo}-${interaction.user.username}`.toLowerCase(),
                    type: ChannelType.GuildText,
                    parent: category.id,
                    topic: interaction.user.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages
                            ]
                        }
                    ]
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("claim_ticket")
                        .setLabel("🛡 Reivindicar")
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId("close_ticket")
                        .setLabel("❌ Fechar")
                        .setStyle(ButtonStyle.Danger)
                );

                await canal.send({
                    content: `✅ <@${interaction.user.id}> Ticket aberto!\n**Produto:** ${tipo.toUpperCase()}`,
                    components: [row]
                });

                return interaction.editReply({ content: `Ticket: <#${canal.id}>` });
            }

            /* FECHAR */
            if (interaction.isButton() && interaction.customId === "close_ticket") {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("sale_yes")
                        .setLabel("✅ Venda")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId("sale_no")
                        .setLabel("❌ Não")
                        .setStyle(ButtonStyle.Danger)
                );

                return interaction.reply({ content: "Houve venda?", components: [row] });
            }

            /* TRANSCRIPT */
            if (interaction.isButton() && interaction.customId === "sale_no") {
                await interaction.update({ content: "📂 A gerar transcrição e a fechar...", components: [] });

                await sendTranscript(interaction.channel, interaction.user.tag);

                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }

        } catch (err) {
            console.error("Erro interaction:", err);
        }
    });
};
