const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder, MessageFlags 
} = require("discord.js");

const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");
const isStaff = require("../helpers/isStaff");

const cooldowns = new Map();

const emojisPagamento = {
    "MBWay": "<:mbway:1464608251516813446>",
    "PayPal": "<:paypal:1464608396383883314>",
    "Revolut": "<:revolut:1464608485617565726>",
    "CartaoCredito": "<:creditcard:1464608966826004676>",
    "GooglePay": "<:googlepay:1464609044315508797>",
    "ApplePay": "<:applepay:1464609102906003588>",
    "ReferenciaMultibanco": "<:multibanco:1464609317926735902>"
};

module.exports = (client) => {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction) return;
        const { guild, channel, user, member } = interaction;
        const cid = interaction.customId;
        if (!guild) return;

        try {
            // 1. MENU INICIAL -> TERMOS
            if (interaction.isStringSelectMenu() && cid === "menu_ticket") {
                const tipo = interaction.values[0];
                const embedTermos = new EmbedBuilder()
                    .setTitle("⚖️ Termos de Serviço - Jordan Shop")
                    .setDescription(
                        "**Termos de Serviço de Reembolso**\n" +
                        "Não oferecemos reembolsos após a conclusão de uma compra ou serviço.\n\n" +
                        "**Termos de Serviço de Substituição**\n" +
                        "A substituição só é possível com um voucher.\n\n" +
                        "**Termos de Serviço da Conta**\n" +
                        "Deverás alterar o e-mail e palavra-passe imediatamente após receberes a conta.\n\n" +
                        "**Idioma do Ticket**\n" +
                        "O suporte é processado exclusivamente em Português.\n\n" +
                        "Ao clicares em **Aceitar**, concordas com todas as nossas regras.\n\n" +
                        "*Atenciosamente, Jordan.*"
                    )
                    .setColor("#ff0000");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ embeds: [embedTermos], components: [row], flags: [MessageFlags.Ephemeral] });
            }

            // 2. ESCOLHER PAGAMENTO (TODOS OS MÉTODOS)
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");
                const menuPag = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("Seleciona o método de pagamento...")
                    .addOptions([
                        { label: "MBWay", value: "MBWay", emoji: "1464608251516813446" },
                        { label: "PayPal", value: "PayPal", emoji: "1464608396383883314" },
                        { label: "Revolut", value: "Revolut", emoji: "1464608485617565726" },
                        { label: "Cartão de Crédito", value: "CartaoCredito", emoji: "1464608966826004676" },
                        { label: "Google Pay", value: "GooglePay", emoji: "1464609044315508797" },
                        { label: "Apple Pay", value: "ApplePay", emoji: "1464609102906003588" },
                        { label: "Multibanco", value: "ReferenciaMultibanco", emoji: "1464609317926735902" }
                    ]);
                return interaction.update({ content: "💳 Escolhe o método:", embeds: [], components: [new ActionRowBuilder().addComponents(menuPag)] });
            }

            // 3. CRIAR TICKET (EMOJI À FRENTE)
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferUpdate();
                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                let cat = guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    parent: cat ? cat.id : null,
                    topic: `${user.id}|${metodo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`Olá <@${user.id}>!\n\n🛡️ **Staff:** Aguardando...\n**Método:** ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ content: `<@${user.id}>`, embeds: [embed], components: [btns] });
                return interaction.editReply({ content: `✅ Canal: ${ticket}`, components: [] });
            }

            // 4. CHAMAR STAFF + COOLDOWN + DM
            if (cid === "call_staff_list") {
                const now = Date.now();
                if (cooldowns.has(user.id) && now < cooldowns.get(user.id) + 300000) {
                    const falta = Math.round((cooldowns.get(user.id) + 300000 - now) / 1000 / 60);
                    return interaction.reply({ content: `⚠️ Aguarda ${falta} min para chamar de novo.`, flags: [MessageFlags.Ephemeral] });
                }

                const members = await guild.members.fetch();
                const staff = members.filter(m => m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) && !m.user.bot);
                const options = staff.map(m => ({ label: m.displayName, value: m.id })).slice(0, 25);
                
                const menu = new StringSelectMenuBuilder().setCustomId("notify_staff_id").addOptions(options);
                return interaction.reply({ content: "Quem queres chamar?", components: [new ActionRowBuilder().addComponents(menu)], flags: [MessageFlags.Ephemeral] });
            }

            if (cid === "notify_staff_id") {
                const staff = await guild.members.fetch(interaction.values[0]);
                cooldowns.set(user.id, Date.now());
                try {
                    await staff.send(`🔔 **Olá!** O <@${user.id}> precisa de ti no ticket ${channel}.`);
                } catch {}
                await channel.send(`📢 <@${staff.id}>, foste chamado!`);
                return interaction.update({ content: "✅ Staff avisado no privado.", components: [] });
            }

            // 5. FECHAR TICKET (ANEXO 1 - TRANSCRIPTS)
            if (cid === "close_ticket" || cid === "save_and_close") {
                if (!isStaff(member)) return interaction.reply({ content: "Staff apenas.", flags: [MessageFlags.Ephemeral] });
                
                await interaction.reply("🔒 A fechar e a gerar log...");
                const logChannel = await guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID || config.LOG_CHANNEL_ID);
                
                // Gera o transcript
                const attachment = await discordTranscripts.createTranscript(channel, { 
                    limit: -1, 
                    fileName: `transcript-${channel.name}.html`,
                    poweredBy: false 
                });

                // Salva no servidor para o link do site funcionar
                const fileName = `ticket-${channel.name}.html`.replace(/\s+/g, "_");
                const transcriptsDir = path.join(__dirname, "../../transcripts");
                if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });
                fs.writeFileSync(path.join(transcriptsDir, fileName), attachment.attachment);

                const siteUrl = `https://discord-bott-jordan.onrender.com/transcripts/${fileName}`;

                const logEmbed = new EmbedBuilder()
                    .setTitle("📄 Transcript Gerado")
                    .addFields(
                        { name: "Canal", value: `#${channel.name}`, inline: true },
                        { name: "Fechado por", value: user.tag, inline: true },
                        { name: "Link Web", value: `[Abrir no Navegador](${siteUrl})` }
                    )
                    .setColor("#8b0000").setTimestamp();

                // ENVIA O FICHEIRO IGUAL AO ANEXO 1
                await logChannel.send({ 
                    embeds: [logEmbed], 
                    files: [attachment] 
                });

                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }

        } catch (err) { console.error(err); }
    });
};
