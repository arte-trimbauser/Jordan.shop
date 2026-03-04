const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, ModalBuilder, 
    TextInputBuilder, TextInputStyle 
} = require("discord.js");
const config = require("../config");
const menus = require("../menus");
const discordTranscripts = require("discord-html-transcripts");
const OpenAI = require('openai');
const fs = require("fs");
const path = require("path");

// --- Configuração OpenAI ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map();
const MAX_HISTORY = 6;
const SYSTEM_PROMPT = `És um assistente inteligente no Discord (Jordan Shop). Respondes em PT-PT.`;

// --- Variáveis de Sistema ---
const saleDrafts = new Map();
const clienteCooldown = new Map();
const staffCooldown = new Map();
const CLIENTE_WAIT = 5 * 60 * 1000;
const STAFF_WAIT = 2 * 60 * 1000;
const DEV_IDS = ["1447241549489639661"]; 

// --- Helpers de Pagamento e Países ---
const COUNTRIES = [
    { label: "Portugal EUR 🇵🇹", value: "Portugal" },
    { label: "Brasil REAL 🇧🇷", value: "Brasil" },
    { label: "Angola Kwanza 🇦🇴", value: "Angola" },
    { label: "Moçambique 🇲🇿", value: "Moçambique" },
    { label: "Cabo Verde 🇨🇻", value: "Cabo Verde" }
];

const PAYMENT_METHODS = [
    { label: "MBWay 📱", value: "MBWay" },
    { label: "PayPal 💳", value: "PayPal" },
    { label: "Revolut 🏦", value: "Revolut" },
    { label: "Google Pay 🛒", value: "GooglePay" },
    { label: "Apple Pay 🍎", value: "ApplePay" }
];

// ======= HELPERS INTERNOS =======
function isStaff(member) {
    if (!member) return false;
    return member.roles?.cache?.some(r => config.STAFF_ROLES.includes(r.id)) || 
           member.permissions?.has(PermissionsBitField.Flags.Administrator);
}

// NOVA FUNÇÃO DE TRANSCRIPT (LIGAÇÃO AO SITE)
async function sendTranscript(channel, userTag, format) {
    try {
        const logChannel = await channel.guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID).catch(() => null);
        
        // Garante que a pasta existe no servidor
        const pastaTranscripts = path.join(__dirname, "../../transcripts");
        if (!fs.existsSync(pastaTranscripts)) fs.mkdirSync(pastaTranscripts, { recursive: true });

        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            filename: `ticket-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        // Guarda o ficheiro para o site ler
        const nomeFicheiro = `ticket-${channel.name}.html`.replace(/\s+/g, '_');
        fs.writeFileSync(path.join(pastaTranscripts, nomeFicheiro), attachment.attachment);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("📄 Transcrição Arquivada")
                .setDescription(`**Canal:** \`${channel.name}\`\n**Fechado por:** \`${userTag}\``)
                .setColor("#b00000")
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Ver no Painel Web")
                    .setURL(`https://jordan-shop-site.onrender.com/transcripts/${nomeFicheiro}`)
                    .setStyle(ButtonStyle.Link)
            );

            await logChannel.send({ embeds: [embed], components: [row], files: [attachment] });
        }
    } catch (err) {
        console.error("Erro ao gerar transcript:", err);
    }
}

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

                try {
                    const completion = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
                        temperature: 0.7
                    });
                    const reply = completion.choices[0].message.content;
                    history.push({ role: 'assistant', content: reply });
                    if (history.length > MAX_HISTORY) history.shift();
                    return await interaction.editReply(reply);
                } catch (err) {
                    return await interaction.editReply('❌ Erro na OpenAI.');
                }
            }

            /* ================== 2. TICKETS E TERMOS ================== */
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

            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");
                await interaction.update({ content: "⏳ A criar ticket...", embeds: [], components: [] });
                
                let category = interaction.guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
                if (!category) category = await interaction.guild.channels.create({ name: config.CATEGORY_NAME, type: 4 });

                const canal = await interaction.guild.channels.create({
                    name: `ticket-${tipo.split('_')[0]}-${user.username}`.toLowerCase(),
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
            if (interaction.isButton() && cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "❌ Só staff.", ephemeral: true });
                await channel.setName(`reivin-${user.username}`);
                return interaction.reply({ content: `🛡 Ticket reivindicado por ${user}.` });
            }

            if (interaction.isButton() && cid === "close_ticket") {
                if (!isStaff(member) && user.id !== channel.topic) return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
                
                if (isStaff(member)) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("sale_yes").setLabel("✅ Venda").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("sale_no").setLabel("❌ Não").setStyle(ButtonStyle.Danger)
                    );
                    return interaction.reply({ content: "Houve venda?", components: [row] });
                } else {
                    await interaction.reply("🔒 A apagar em 10s...");
                    setTimeout(() => channel.delete().catch(() => {}), 10000);
                }
            }

            /* ================== 4. FINALIZAÇÃO (TRANSCRIPT) ================== */
            if (interaction.isButton() && cid === "sale_no") {
                await interaction.update({ content: "📂 A gerar transcrição e a fechar...", components: [] });
                await sendTranscript(channel, user.tag, "html");
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) {
            console.error("Erro:", err);
        }
    });
};
