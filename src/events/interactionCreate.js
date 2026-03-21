const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, ChannelType 
} = require("discord.js");

const config = require("../config");
const isStaff = require("../helpers/isStaff");
const discordTranscripts = require("discord-html-transcripts");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const emojisPagamento = {
    "MBWay": "<:mbway:1464608251516813446>",
    "PayPal": "<:paypal:1464608396383883314>",
    "Revolut": "<:revolut:1464608485617565726>",
    "CartaoCredito": "<:creditcard:1464608966826004676>",
    "GooglePay": "<:googlepay:1464609044315508797>",
    "ApplePay": "<:applepay:1464609102906003588>",
    "ReferenciaMultibanco": "<:multibanco:1464609317926735902>"
};

async function sendTranscript(channel, userTag) {
    try {
        const attachment = await discordTranscripts.createTranscript(channel, {
            filename: `ticket-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const fileName = `ticket-${channel.name}.html`
            .replace(/\s+/g, "_")
            .toLowerCase();

        const { error } = await supabase.storage
            .from("transcripts")
            .upload(fileName, attachment.attachment, {
                contentType: "text/html",
                upsert: true
            });

        if (error) return console.error(error);

        const { data } = supabase.storage
            .from("transcripts")
            .getPublicUrl(fileName);

        const link = data.publicUrl;

        const logChan = await channel.guild.channels
            .fetch(config.TRANSCRIPT_LOG_CHANNEL_ID)
            .catch(() => null);

        if (logChan) {
            const embed = new EmbedBuilder()
                .setTitle("📄 Transcript Guardado")
                .setDescription(`Ticket: ${channel.name}\nFechado por: ${userTag}`)
                .setColor("#2f3136");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Abrir Transcript")
                    .setURL(link)
                    .setStyle(ButtonStyle.Link)
            );

            await logChan.send({ embeds: [embed], components: [row] });
        }

    } catch (err) {
        console.error("Transcript error:", err);
    }
}

module.exports = (client) => {
client.on("interactionCreate", async (interaction) => {

try {

if (!interaction.guild) return;
const { guild, channel, user, member, customId: cid } = interaction;

if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
const tipo = interaction.values[0];

const embed = new EmbedBuilder()
.setTitle("⚖️ Termos de Serviço")
.setDescription("Ao aceitar concordas com os termos.")
.setColor("#ff0000");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
);

return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
const tipo = cid.replace("aceitar_termos_", "");

const menu = new StringSelectMenuBuilder()
.setCustomId(`pagamento_${tipo}`)
.setPlaceholder("Seleciona pagamento")
.addOptions(Object.keys(emojisPagamento).map(m => ({
label: m,
value: m,
emoji: emojisPagamento[m].match(/\d+/)[0]
})));

return interaction.update({
content: "Escolhe pagamento:",
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {

await interaction.deferReply({ ephemeral: true });

const tipo = cid.replace("pagamento_", "");
const metodo = interaction.values[0];
const emoji = emojisPagamento[metodo] || "💰";

const ticket = await guild.channels.create({
name: `ticket-${user.username}`,
type: ChannelType.GuildText,
parent: config.CATEGORY_ID,
topic: `${user.id}|${metodo}`,
permissionOverwrites: [
{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
...config.STAFF_ROLES.map(r => ({
id: r,
allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
}))
]
});

const embed = new EmbedBuilder()
.setTitle("Jordan Shop")
.setDescription(`🛡 Staff: Aguardando\n💳 ${emoji} ${metodo}`)
.setColor("#2f3136");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
);

await ticket.send({
content: `<@${user.id}> ticket aberto`,
embeds: [embed],
components: [row]
});

return interaction.editReply({
content: `✅ Ticket criado: <#${ticket.id}>`
});
}

if (interaction.isButton() && cid === "claim_ticket") {
if (!isStaff(member)) return;

const [uid, met] = channel.topic.split("|");
const emoji = emojisPagamento[met] || "💰";

const embed = new EmbedBuilder()
.setTitle("Ticket Reivindicado")
.setDescription(`Staff: <@${user.id}>\n💳 ${emoji} ${met}`)
.setColor("#57f287");

return interaction.update({ embeds: [embed], components: [] });
}

if (interaction.isButton() && cid === "close_ticket") {
if (!isStaff(member)) return;

await interaction.reply("A fechar...");
await sendTranscript(channel, user.tag);
setTimeout(() => channel.delete().catch(()=>{}), 4000);
}

} catch (err) {
console.error(err);
}

});
};
