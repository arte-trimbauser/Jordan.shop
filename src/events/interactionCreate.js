const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");
const config = require("../config");
const OpenAI = require('openai');

// --- Configuração OpenAI ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map();
const MAX_HISTORY = 6;
const SYSTEM_PROMPT = `És um assistente inteligente no Discord (Jordan Shop). Respondes em PT-PT.`;

module.exports = async (client) => {
  client.on("interactionCreate", async (interaction) => {
    try {
      const { channel, user, customId, member } = interaction;

      /* ================== 1. SLASH COMMANDS (/chat) ================== */
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'chat') {
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
            console.error(err);
            return await interaction.editReply('❌ Erro na OpenAI.');
          }
        }
      }

      /* ================== 1. SELEÇÃO NO MENU (TERMOS) ================== */
      if (interaction.isStringSelectMenu() && customId === "menu_ticket") {
        const tipo = interaction.values[0];
        const termosEmbed = new EmbedBuilder()
          .setTitle("⚖️ Termos de Serviço - Jordan Shop")
          .setDescription(
            "**Termos de Serviço de Reembolso**\n" +
            "Não oferecemos reembolsos após a conclusão de uma compra ou serviço. Em casos excepcionais, uma substituição pode ser oferecida, se possível.\n\n" +
            "**Termos de Serviço de Substituição**\n" +
            "A substituição só é possível com um voucher.\n" +
            "Sem voucher = sem garantia ou substituição.\n\n" +
            "**Termos de Serviço da Conta**\n" +
            "Após receber uma conta, você deverá alterar seu endereço de e-mail e senha imediatamente.\n" +
            "Não assumimos qualquer responsabilidade ou substituição caso você não o faça.\n\n" +
            "**Termos de Serviço do PayPal**\n" +
            "Os pagamentos devem ser enviados via \"Amigos e Familiares\" – sem uma mensagem nos detalhes de pagamento.\n" +
            "Não nos responsabilizamos se nossa conta do PayPal for bloqueada e os fundos permanecerem lá. Não há reembolsos possíveis!\n\n" +
            "**Idioma do Ticket**\n" +
            "O suporte e os tickets são processados exclusivamente em Português.\n\n" +
            "**Comportamento do Ticket**\n" +
            "Por favor, não envie spam ou ping várias vezes em DM ou tickets.\n" +
            "Aguarde pacientemente até receber seu produto ou uma resposta.\n\n" +
            "*Atenciosamente, Jordan.*"
          )
          .setColor("#ff0000");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aceitar_termos_${tipo}`).setLabel("Aceitar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("recusar_termos").setLabel("Recusar").setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [termosEmbed], components: [row], ephemeral: true });
      }

      /* ================== 2. ACEITAR TERMOS E CRIAR CANAL ================== */
      if (interaction.isButton() && customId.startsWith("aceitar_termos_")) {
        const tipo = customId.replace("aceitar_termos_", "");
        await interaction.update({ content: "⏳ A criar o teu ticket...", embeds: [], components: [] });

        let category = interaction.guild.channels.cache.find(c => c.name === config.CATEGORY_NAME && c.type === 4);
        if (!category) category = await interaction.guild.channels.create({ name: config.CATEGORY_NAME, type: 4 });

        const canal = await interaction.guild.channels.create({
          name: `ticket-${user.username}`.toLowerCase(),
          parent: category.id,
          topic: user.id,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ...config.STAFF_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
          ]
        });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("close_ticket").setLabel("❌ Fechar").setStyle(ButtonStyle.Danger)
        );

        await canal.send({ content: `✅ <@${user.id}> Ticket aberto!\n**Produto:** ${tipo.toUpperCase()}`, components: [buttons] });
        return interaction.editReply({ content: `✅ Ticket aberto: <#${canal.id}>` });
      }
      
      /* ================== 4. RECUSAR TERMOS ================== */
      if (interaction.isButton() && customId === "recusar_termos") {
        return interaction.update({ content: "❌ Precisas de aceitar para abrir ticket.", embeds: [], components: [] });
      }

    } catch (err) {
      console.error("Erro interactionCreate:", err);
    }
  });
};
