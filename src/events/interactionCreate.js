const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, ModalBuilder, 
    TextInputBuilder, TextInputStyle, ChannelType
} = require("discord.js");
const config = require("../config");
const menus = require("../menus");
const discordTranscripts = require("discord-html-transcripts");
const OpenAI = require('openai');
const fs = require("fs");
const path = require("path");

// --- Configuração OpenAI (Igual ao teu original) ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map();
const MAX_HISTORY = 6;
const SYSTEM_PROMPT = `És um assistente inteligente no Discord (Jordan Shop). Respondes em PT-PT.`;

// --- Variáveis de Sistema ---
const saleDrafts = new Map();
const clienteCooldown = new Map();
const staffCooldown = new Map();

const supabase = require("../../supabase");

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

        // upload para supabase
        const { error } = await supabase.storage
            .from('transcripts')
            .upload(nomeFicheiro, attachment.attachment, {
                contentType: 'text/html',
                upsert: true
            });

        if (error) {
            console.error("Erro upload:", error);
            return;
        }

        const { data } = supabase.storage
            .from('transcripts')
            .getPublicUrl(nomeFicheiro);

        const link = data.publicUrl;

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("📄 Transcrição Arquivada")
                .setDescription(`**Canal:** \`${channel.name}\`\n**Fechado por:** \`${userTag}\``)
                .setColor("#b00000")
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Ver no Painel Web")
                    .setURL(link)
                    .setStyle(ButtonStyle.Link)
            );

            await logChannel.send({
                embeds: [embed],
                components: [row],
                files: [attachment]
            });
        }

    } catch (err) {
        console.error("Erro ao gerar transcript:", err);
    }
}

// ======= CORE DO BOT =======
module.exports = async (client) => {
    client.on("interactionCreate", async (interaction) => {
        try {
            const { channel, user, member, customId: cid } = interaction;

            /* ================== 1. SLASH COMMANDS (/chat) ================== */
            if (interaction.isChatInputCommand() && interaction.commandName === 'chat') {
                const userPrompt = interaction.options.getString('mensagem');
                await interaction.deferReply();
                if (!memory.has(user.id)) memory.set(user.id, []);
                const history = memory.get(user.id);
                history.push({ role: 'user', content: userPrompt });

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
                    temperature: 0.7
                });
                const reply = completion.choices[0].message.content;
                history.push({ role: 'assistant', content: reply });
                if (history.length > MAX_HISTORY) history.shift();
                return await interaction.editReply(reply);
            }

            /* ================== 2. TICKETS E TERMOS (TEUS TERMOS ORIGINAIS) ================== */
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
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
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ embeds: [termosEmbed], components: [row], ephemeral: true });
            }

            // CRIAÇÃO DO TICKET
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");
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
                    name: `ticket-${tipo.split('_')[0]}-${user.username}`.toLowerCase(),
                    type: ChannelType.GuildText,
                    parent: category.id,
                    topic: user.id,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("🛡 Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("❌ Fechar").setStyle(ButtonStyle.Danger)
                );
                await canal.send({ content: `✅ <@${user.id}> Ticket aberto!\n**Produto:** ${tipo.toUpperCase()}`, components: [row] });
                return interaction.editReply({ content: `Ticket: <#${canal.id}>` });
            }

            /* ================== 3. REIVINDICAÇÃO E FECHO ================== */
            if (interaction.isButton() && cid === "close_ticket") {
                // Lógica de fecho com a pergunta da venda (Igual ao teu original)
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("sale_yes").setLabel("✅ Venda").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("sale_no").setLabel("❌ Não").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ content: "Houve venda?", components: [row] });
            }

            /* ================== 4. FINALIZAÇÃO E TRANSCRIPT ================== */
            if (interaction.isButton() && cid === "sale_no") {
                await interaction.update({ content: "📂 A gerar transcrição e a fechar...", components: [] });
                
                // CHAMA A FUNÇÃO DE TRANSCRIPT QUE GUARDA NO SITE
                await sendTranscript(channel, user.tag);

                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

        } catch (err) {
            console.error("Erro no InteractionCreate:", err);
        }
    });
};

