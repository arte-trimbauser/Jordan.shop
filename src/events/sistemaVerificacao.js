// src/events/sistemaVerificacao.js - SISTEMA DE VERIFICACAO COM /verificacao

const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    MessageFlags,
    SlashCommandBuilder
} = require('discord.js');

const CONFIG = {
    CANAL_VERIFICACAO_ID: '1393690238903128115',
    CANAL_LOGS_ID: '1437076921627181228',
    CARGO_NAO_VERIFICADO_ID: '1393658218722623529',
    CARGO_VERIFICADO_ID: '1393658270996234351',
    PALAVRA_CHAVE: 'JORDAN',
    MINUTO_ESPERA: 0
};

const usuariosVerificados = new Set();
const usuariosComModalAberto = new Set();
let verificacaoEnviada = false;
let verificacaoAtiva = true;

async function registrarComandoVerificacao(client) {
    try {
        const guild = await client.guilds.fetch("1393629457599828040");
        const comando = new SlashCommandBuilder()
            .setName('verificacao')
            .setDescription('Ativar ou desativar o sistema de verificacao de novos membros')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(option =>
                option.setName('estado')
                    .setDescription('Escolhe o estado da verificacao')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Ativar', value: 'ativar' },
                        { name: 'Desativar', value: 'desativar' }
                    )
            );
        await guild.commands.create(comando);
        console.log('✅ Comando /verificacao registado');
    } catch (err) {
        console.error('❌ Erro ao registar /verificacao:', err);
    }
}

async function enviarVerificacao(client) {
    try {
        if (verificacaoEnviada) {
            console.log('Mensagem de verificacao ja foi enviada anteriormente');
            return;
        }
        const canal = await client.channels.fetch(CONFIG.CANAL_VERIFICACAO_ID);
        if (!canal) {
            console.error('Canal de verificacao nao encontrado!');
            return;
        }
        const mensagens = await canal.messages.fetch({ limit: 20 });
        const jaExiste = mensagens.some(m => 
            m.author.id === client.user.id && 
            m.components.length > 0 &&
            m.embeds.length > 0 &&
            m.embeds[0].title &&
            m.embeds[0].title.includes('Verificacao')
        );
        if (jaExiste) {
            console.log('Mensagem de verificacao ja existe no canal');
            verificacaoEnviada = true;
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle('Verificacao de Seguranca - Jordan Shop')
            .setDescription(`**Bem-vindo a Jordan Shop!**

Para acederes a loja e garantires que nao es um bot de spam, clica no botao abaixo e insere o codigo de verificacao.

**Ao verificares, concordas com as regras do servidor.**`)
            .setColor('#5865F2')
            .setFooter({ text: 'Sistema de Protecao Anti-Bot' })
            .setThumbnail('https://media.discordapp.net/attachments/1405525830796443698/1495409662965579886/Ola_User.png?ex=69e62447&is=69e4d2c7&hm=8fc8e3377883af78de38a2573039773ce747d8c6b6657a68ff7dbc4e92a6ce91&=&format=webp&quality=lossless&width=800&height=800')
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('iniciar_verificacao')
                .setLabel('Iniciar Verificacao')
                .setStyle(ButtonStyle.Success)
        );
        await canal.send({ embeds: [embed], components: [row] });
        verificacaoEnviada = true;
        console.log('Sistema de verificacao enviado (primeira vez)');
    } catch (err) {
        console.error('Erro ao enviar verificacao:', err.message);
    }
}

function setupGuildMemberAdd(client) {
    client.on('guildMemberRemove', (member) => {
        usuariosComModalAberto.delete(member.user.id);
        usuariosVerificados.delete(member.user.id);
        console.log(`Estado limpo para ${member.user.tag} (saiu do servidor)`);
    });

    client.on('guildMemberAdd', async (member) => {
        if (!verificacaoAtiva) {
            console.log(`Verificacao desativada - ${member.user.tag} entrou sem verificacao`);
            return;
        }
        try {
            const contaIdade = Date.now() - member.user.createdAt;
            const dias = contaIdade / (1000 * 60 * 60 * 24);
            if (dias < 7) {
                console.log(`Conta muito recente: ${member.user.tag} (${dias.toFixed(1)} dias)`);
            }
            await member.roles.add(CONFIG.CARGO_NAO_VERIFICADO_ID);
            console.log(`${member.user.tag} entrou e recebeu cargo nao verificado`);
            try {
                await member.send(`Bem-vindo a Jordan Shop!

Para acederes a loja, passa pela verificacao no canal #verificacao.
Isto protege a nossa comunidade contra bots de spam.`);
            } catch {}
        } catch (err) {
            console.error('Erro ao processar novo membro:', err);
        }
    });
}

async function handleVerificacaoInteraction(interaction, client) {
    const { customId, member, user, commandName } = interaction;

    if (interaction.isChatInputCommand() && commandName === 'verificacao') {
        const estado = interaction.options.getString('estado');
        if (estado === 'ativar') {
            verificacaoAtiva = true;
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Verificacao Ativada')
                .setDescription('O sistema de verificacao de novos membros foi **ativado**.\n\nNovos membros terao de se verificar para aceder ao servidor.')
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } else {
            verificacaoAtiva = false;
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Verificacao Desativada')
                .setDescription('O sistema de verificacao de novos membros foi **desativado**.\n\nNovos membros terao acesso automatico ao servidor.')
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }
        return true;
    }

    if (customId === 'iniciar_verificacao') {
        if (!verificacaoAtiva) {
            return interaction.reply({
                content: '⚠️ O sistema de verificacao esta desativado. Podes aceder ao servidor normalmente.',
                flags: MessageFlags.Ephemeral
            });
        }
        const tempoNoServidor = Date.now() - member.joinedAt;
        const minutosNoServidor = tempoNoServidor / (1000 * 60);
        if (minutosNoServidor < CONFIG.MINUTO_ESPERA) {
            const minutosRestantes = Math.ceil(CONFIG.MINUTO_ESPERA - minutosNoServidor);
            return interaction.reply({
                content: `Aguarda ${minutosRestantes} minuto(s) antes de te verificares.`,
                flags: MessageFlags.Ephemeral
            });
        }
        if (member.roles.cache.has(CONFIG.CARGO_VERIFICADO_ID)) {
            return interaction.reply({
                content: 'Ja estas verificado!',
                flags: MessageFlags.Ephemeral
            });
        }
        const modal = new ModalBuilder()
            .setCustomId('modal_verificacao')
            .setTitle('Verificacao Jordan Shop');
        const input = new TextInputBuilder()
            .setCustomId('codigo_verificacao')
            .setLabel(`Insere o codigo: ${CONFIG.PALAVRA_CHAVE}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Escreve aqui o codigo...')
            .setRequired(true)
            .setMaxLength(20);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_verificacao') {
        const codigo = interaction.fields.getTextInputValue('codigo_verificacao');
        if (codigo.toUpperCase() === CONFIG.PALAVRA_CHAVE) {
            try {
                await member.roles.remove(CONFIG.CARGO_NAO_VERIFICADO_ID);
                await member.roles.add(CONFIG.CARGO_VERIFICADO_ID);
                const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                if (logChannel) {
                    const embedLog = new EmbedBuilder()
                        .setTitle('✅ Novo Membro Verificado')
                        .setDescription(`**Utilizador:** <@${user.id}> (${user.username})\n**Conta criada:** <t:${Math.floor(user.createdAt.getTime()/1000)}:R>`)
                        .setColor('#00ff00')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embedLog] });
                }
                return interaction.reply({
                    content: '✅ Verificacao concluida! Agora tens acesso a loja.',
                    flags: MessageFlags.Ephemeral
                });
            } catch (err) {
                console.error('Erro ao trocar cargos:', err);
                return interaction.reply({
                    content: '❌ Erro ao processar cargos. Verifica a hierarquia do bot.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } else {
            return interaction.reply({
                content: '❌ Codigo incorreto! Tenta novamente.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    return false;
}

function setupAntiSpam(client) {
    const palavrasProibidas = [
        'discord.gg', 'discord.com/invite',
        'bit.ly', 'tinyurl', 'short.link',
        'free nitro', 'free robux', 'cam girl',
        'look at the girl', 'she in cam',
        'mrbeast', 'crypto giveaway'
    ];

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        const { member, content, channel } = message;
        const contentLower = content.toLowerCase();
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const temEveryone = content.includes('@everyone') || content.includes('@here');
        const temLinkProibido = palavrasProibidas.some(palavra => contentLower.includes(palavra));
        if (temEveryone || temLinkProibido) {
            try {
                await message.delete();
                await member.timeout(60 * 60 * 1000, 'Spam/Links suspeitos detectados');
                if (member.roles.cache.has(CONFIG.CARGO_VERIFICADO_ID)) {
                    await member.roles.remove(CONFIG.CARGO_VERIFICADO_ID);
                    await member.roles.add(CONFIG.CARGO_NAO_VERIFICADO_ID);
                }
                const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Anti-Spam Ativado')
                        .setDescription(`**Utilizador:** <@${message.author.id}> (${message.author.username})\n**Motivo:** Spam/Link proibido\n**Mensagem:** ${content.slice(0, 100)}`)
                        .setColor('#ff0000')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('Erro no anti-spam:', err);
            }
        }
    });
}

function inicializarSistemaVerificacao(client) {
    setupGuildMemberAdd(client);
    setupAntiSpam(client);
    registrarComandoVerificacao(client);
    console.log('✅ Sistema de verificacao inicializado (com /verificacao)');
}

module.exports = {
    enviarVerificacao,
    inicializarSistemaVerificacao,
    handleVerificacaoInteraction
};
