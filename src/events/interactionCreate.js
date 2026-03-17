const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    PermissionsBitField, StringSelectMenuBuilder 
} = require("discord.js");

const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
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
        const { guild, channel, user, member, customId: cid } = interaction;
        if (!guild) return;

        try {
            // 1. MENU INICIAL -> TERMOS (TEUS TEXTOS ORIGINAIS)
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
                    new ButtonBuilder().setCustomId(`recusar_termos_${tipo}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
                );
                
                return await interaction.reply({ embeds: [embedTermos], components: [row], flags: [64] });
            }

            // 2. RECUSAR TERMOS
            if (interaction.isButton() && cid?.startsWith("recusar_termos_")) {
                const tipo = cid.replace("recusar_termos_", "");
                
                const logChan = await guild.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
                if (logChan && logChan.send) {
                    await logChan.send(`❌ <@${user.id}> não aceitou os termos para o canal \`${tipo}\`.`).catch(() => {});
                }

                return await interaction.update({ 
                    content: "⚠️ **Tens que aceitar os termos para abrir o ticket.**", 
                    embeds: [], 
                    components: [] 
                });
            }

            // 3. ACEITAR TERMOS -> PAGAMENTO
            if (interaction.isButton() && cid?.startsWith("aceitar_termos_")) {
                const tipo = cid.replace("aceitar_termos_", "");

                const logChan = await guild.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
                if (logChan && logChan.send) {
                    await logChan.send(`✅ <@${user.id}> aceitou os termos para o canal \`${tipo}\`.`).catch(() => {});
                }

                const menuPag = new StringSelectMenuBuilder()
                    .setCustomId(`pagamento_${tipo}`)
                    .setPlaceholder("Seleciona o método de pagamento...")
                    .addOptions(Object.keys(emojisPagamento).map(m => ({ 
                        label: m, 
                        value: m, 
                        emoji: emojisPagamento[m].match(/\d+/)[0] 
                    })));

                return await interaction.update({ 
                    content: "💳 **Termos aceites!** Escolhe o método de pagamento para abrir o ticket:", 
                    embeds: [], 
                    components: [new ActionRowBuilder().addComponents(menuPag)] 
                });
            }

            // 4. CRIAR TICKET (COM DEFERUPDATE PARA O RENDER)
            if (interaction.isStringSelectMenu() && cid?.startsWith("pagamento_")) {
                await interaction.deferUpdate();

                const tipo = cid.replace("pagamento_", "");
                const metodo = interaction.values[0];
                const emoji = emojisPagamento[metodo] || "💰";

                const cat = guild.channels.cache.get(config.CATEGORY_ID);
                const ticket = await guild.channels.create({
                    name: `ticket-${tipo}-${user.username}`,
                    parent: cat ? cat.id : null,
                    topic: `${user.id}|${metodo}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        ...config.STAFF_ROLES.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                    ]
                });

                const embedMsg = new EmbedBuilder()
                    .setTitle("Jordan Shop | Suporte")
                    .setDescription(`🛡️ **Staff:** Aguardando...\n**Método:** ${emoji} ${metodo}`)
                    .setColor("#2f3136");

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reivindicar").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                );

                await ticket.send({ 
                    content: `<@${user.id}> obrigado(a) por criar um ticket, em breve algum staff te ajudará.`, 
                    embeds: [embedMsg], 
                    components: [btns] 
                });

                return await interaction.editReply({ content: `✅ Ticket criado: ${ticket}`, components: [], embeds: [] });
            }

            // 5. REIVINDICAR TICKET
            if (cid === "claim_ticket") {
                if (!isStaff(member)) return interaction.reply({ content: "Staff apenas.", flags: [64] });
                const [uid, met] = channel.topic?.split("|") || ["?", "Não definido"];
                const emj = emojisPagamento[met] || "💰";

                const embedClaim = new EmbedBuilder()
                    .setTitle("🛡️ Ticket Reivindicado")
                    .setDescription(`👤 **Staff:** <@${user.id}>\n**Método:** ${emj} ${met}`)
                    .setColor("#57f287");

                return await interaction.update({
                    embeds: [embedClaim],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("claimed").setLabel("Reivindicado").setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId("call_staff_list").setLabel("🔔 Chamar Staff").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
                    )]
                });
            }

            // 6. CHAMAR STAFF (COM COOLDOWN E VISUAL DA IMAGEM - SÓ NO PRIVADO)
            if (cid === "call_staff_list") {
                const tempoEspera = 300000; // 5 minutos
                const agora = Date.now();
                
                if (cooldowns.has(user.id)) {
                    const expira = cooldowns.get(user.id) + tempoEspera;
                    if (agora < expira) {
                        const falta = expira - agora;
                        const min = Math.floor(falta / 60000);
                        const seg = Math.floor((falta % 60000) / 1000);
                        return await interaction.reply({ 
                            content: `⚠️ <@${user.id}>, falta-te **${min}minutos ${seg}segundos** para poderes chamar a staff novamente!`, 
                            flags: [64] 
                        });
                    }
                }

                const members = await guild.members.fetch();
                const staffOnline = members.filter(m => m.roles.cache.some(r => config.STAFF_ROLES.includes(r.id)) && !m.user.bot);
                
                if (staffOnline.size === 0) return await interaction.reply({ content: "Sem Staff online.", flags: [64] });

                const opts = staffOnline.map(m => ({ label: m.displayName, value: m.id })).slice(0, 25);
                const menuS = new StringSelectMenuBuilder().setCustomId("notify_staff_id").setPlaceholder("Escolhe um Staff").addOptions(opts);
                
                return await interaction.reply({ content: "Quem queres chamar?", components: [new ActionRowBuilder().addComponents(menuS)], flags: [64] });
            }

            if (cid === "notify_staff_id") {
                const target = await guild.members.fetch(interaction.values[0]);
                cooldowns.set(user.id, Date.now());

                // Embed para o PRIVADO (DM) - Estilo da imagem
                const embedDM = new EmbedBuilder()
                    .setTitle("📞 Cliente chamou a staff")
                    .setDescription(`O cliente **${user.username}** chamou-te no ticket:\n🔗 **Jordan Shop** › ${channel}`)
                    .setColor("#f1c40f")
                    .setTimestamp();

                // Botão de link para ir ao canal
                const rowLink = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Ir para o Ticket")
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)
                );

                await target.send({ embeds: [embedDM], components: [rowLink] }).catch(() => {});
                
                await channel.send({ content: `📢 <@${target.id}>, foste solicitado aqui!` });
                return await interaction.update({ content: "✅ Staff notificado no privado.", components: [] });
            }

            // 7. FECHAR TICKET & TRANSCRIPT
            if (cid === "close_ticket") {
                if (!isStaff(member)) return;
                await interaction.reply("🔒 A gerar transcrição e a fechar...");

                const attachment = await discordTranscripts.createTranscript(channel, {
                    limit: -1,
                    fileName: `transcript-${channel.name}.html`,
                    poweredBy: false
                });

                const logChan = await guild.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
                if (logChan && logChan.send) {
                    const embedLog = new EmbedBuilder()
                        .setTitle("📄 Transcrição Arquivada")
                        .addFields(
                            { name: "Canal:", value: `\`${channel.name}\``, inline: true },
                            { name: "Fechado por:", value: `${user.username}`, inline: true }
                        )
                        .setColor("#ff0000")
                        .setTimestamp();

                    await logChan.send({ embeds: [embedLog], files: [attachment] }).catch(() => {});
                }
                
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

        } catch (err) { console.error("❌ Erro:", err.message); }
    });
};
