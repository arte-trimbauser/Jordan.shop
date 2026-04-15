const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const CONFIG_VERIF = {
    CANAL_ID: '1393690238903128115',
    CARGO_VERIFICADO: '1393658270996234351',
    CARGO_NAO_VERIFICADO: '1393658218722623529',
    CODIGO: 'JORDAN'
};

async function enviarVerificacao(client) {
    const canal = await client.channels.fetch(CONFIG_VERIF.CANAL_ID);
    if (!canal) return;

    const mensagens = await canal.messages.fetch({ limit: 10 });
    if (mensagens.some(m => m.embeds[0]?.title?.includes('Verificação'))) return;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Verificação de Segurança')
        .setDescription('Clica no botão para provar que não és um bot.')
        .setColor('#5865F2');

    const botao = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('iniciar_verificacao').setLabel('🔐 Verificar').setStyle(ButtonStyle.Success)
    );

    await canal.send({ embeds: [embed], components: [botao] });
}

async function handleVerificacaoInteraction(interaction) {
    if (interaction.customId === 'iniciar_verificacao') {
        const modal = new ModalBuilder().setCustomId('modal_verif').setTitle('Código de Segurança');
        const input = new TextInputBuilder()
            .setCustomId('input_codigo')
            .setLabel(`Escreve: ${CONFIG_VERIF.CODIGO}`)
            .setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_verif') {
        const resposta = interaction.fields.getTextInputValue('input_codigo');
        if (resposta.toUpperCase() === CONFIG_VERIF.CODIGO) {
            await interaction.member.roles.add(CONFIG_VERIF.CARGO_VERIFICADO);
            await interaction.member.roles.remove(CONFIG_VERIF.CARGO_NAO_VERIFICADO);
            await interaction.reply({ content: '✅ Verificado com sucesso!', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Código errado!', ephemeral: true });
        }
    }
}

module.exports = { enviarVerificacao, handleVerificacaoInteraction };
