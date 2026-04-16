// src/events/sistemaVerificacao.js - SISTEMA DE VERIFICAÇAO ANTI-SPAM (CORRIGIDO)

const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

// CONFIGURACOES
const CONFIG = {
    CANAL_VERIFICACAO_ID: '1393690238903128115',
    CANAL_LOGS_ID: '1437076921627181228',
    CARGO_NAO_VERIFICADO_ID: '1393658218722623529',
    CARGO_VERIFICADO_ID: '1393658270996234351',
    PALAVRA_CHAVE: 'JORDAN',
    MINUTO_ESPERA: 0
};

// Maps para controlo
const usuariosVerificados = new Set();
const usuariosComModalAberto = new Set();
let verificacaoEnviada = false;

// ============================================================================
// 1. ENVIAR MENSAGEM DE VERIFICACAO NO CANAL (SO UMA VEZ)
// ============================================================================

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
            .setDescription(
                '**Bem-vindo a Jordan Shop!**\n\n' +
                'Para acederes a loja e garantires que nao es um bot de spam, ' +
                'clica no botao abaixo e insere o codigo de verificacao.\n\n' +
                '**Ao verificares, concordas com as regras do servidor.**'
            )
            .setColor('#5865F2')
            .setImage('https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp')
            .setFooter({ text: 'Sistema de Protecao Anti-Bot' })
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

// ============================================================================
// 2. QUANDO NOVO MEMBRO ENTRA - DAR CARGO NAO VERIFICADO
// ============================================================================

function setupGuildMemberAdd(client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            const contaIdade = Date.now() - member.user.createdAt;
            const dias = contaIdade / (1000 * 60 * 60 * 24);

            if (dias < 7) {
                console.log(`Conta muito recente: ${member.user.tag} (${dias.toFixed(1)} dias)`);
            }

            await member.roles.add(CONFIG.CARGO_NAO_VERIFICADO_ID);
            console.log(`${member.user.tag} entrou e recebeu cargo nao verificado`);

            try {
                await member.send(
                    'Bem-vindo a Jordan Shop!\n\n' +
                    'Para acederes a loja, passa pela verificacao no canal #verificacao.\n' +
                    'Isto protege a nossa comunidade contra bots de spam.'
                );
            } catch {
                // DM fechada, ignorar
            }

        } catch (err) {
            console.error('Erro ao processar novo membro:', err);
        }
    });
}

// ============================================================================
// 3. HANDLER DE INTERACOES (BOTAO E MODAL) - CORRIGIDO
// ============================================================================

async function handleVerificacaoInteraction(interaction, client) {
    const { customId, member, user, guild } = interaction;

    if (customId === 'iniciar_verificacao') {
        // IMPORTANTE: Defer imediatamente para evitar "Unknown Interaction"
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const tempoNoServidor = Date.now() - member.joinedAt;
        const minutosNoServidor = tempoNoServidor / (1000 * 60);

        if (minutosNoServidor < CONFIG.MINUTO_ESPERA) {
            const minutosRestantes = Math.ceil(CONFIG.MINUTO_ESPERA - minutosNoServidor);
            return interaction.editReply({
                content: `Aguarda ${minutosRestantes} minuto(s) antes de te verificares.`
            });
        }

        // Verificar se ja esta verificado - SO MOSTRA PARA O USER (EPHEMERAL)
        if (member.roles.cache.has(CONFIG.CARGO_VERIFICADO_ID) || usuariosVerificados.has(user.id)) {
            // SO O USER VE ESTA MENSAGEM - O BOTAO DO SERVIDOR CONTINUA ATIVO
            return interaction.editReply({
                content: 'Ja estas verificado!'
            });
        }

        // Verificar se ja tem modal aberto (anti-spam de cliques)
        if (usuariosComModalAberto.has(user.id)) {
            return interaction.editReply({
                content: 'Ja tens um modal aberto. Completa-o primeiro!'
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

        // Marcar que usuario tem modal aberto
        usuariosComModalAberto.add(user.id);

        // Auto-remover apos 5 minutos (timeout do modal)
        setTimeout(() => {
            usuariosComModalAberto.delete(user.id);
        }, 5 * 60 * 1000);

        // Usar followUp em vez de reply porque ja fizemos defer
        await interaction.followUp({
            content: 'Abre o modal acima para te verificares!',
            flags: MessageFlags.Ephemeral
        });

        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_verificacao') {
        // Remover do set de modais abertos
        usuariosComModalAberto.delete(user.id);

        const codigo = interaction.fields.getTextInputValue('codigo_verificacao');

        if (codigo.toUpperCase() === CONFIG.PALAVRA_CHAVE) {
            try {
                await member.roles.remove(CONFIG.CARGO_NAO_VERIFICADO_ID);
                await member.roles.add(CONFIG.CARGO_VERIFICADO_ID);

                // MARCAR COMO VERIFICADO NO SET
                usuariosVerificados.add(user.id);

                // Log
                const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                if (logChannel) {
                    const embedLog = new EmbedBuilder()
                        .setTitle('Novo Membro Verificado')
                        .setDescription(`**Utilizador:** <@${user.id}>\n**Conta criada:** <t:${Math.floor(user.createdAt.getTime()/1000)}:R>`)
                        .setColor('#00ff00')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embedLog] });
                }

                // SO O USER VE A CONFIRMACAO - O BOTAO DO SERVIDOR CONTINUA ATIVO PARA OUTROS
                return interaction.reply({
                    content: 'Verificacao concluida!\n\nAgora tens acesso a loja.',
                    flags: MessageFlags.Ephemeral
                });

            } catch (err) {
                console.error('Erro ao trocar cargos:', err);
                return interaction.reply({
                    content: 'Erro ao processar verificacao. Contacta um administrador.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } else {
            return interaction.reply({
                content: 'Codigo incorreto! Tenta novamente clicando no botao.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    return false;
}

// ============================================================================
// 4. SISTEMA ANTI-SPAM
// ============================================================================

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
                    const embedAlerta = new EmbedBuilder()
                        .setTitle('SPAM DETETADO E BLOQUEADO')
                        .setDescription(
                            `**Utilizador:** <@${message.author.id}> (${message.author.tag})\n` +
                            `**Canal:** ${channel}\n` +
                            `**Motivo:** ${temEveryone ? '@everyone/@here' : 'Link proibido'}\n` +
                            `**Mensagem:** ||${content.substring(0, 100)}||`
                        )
                        .setColor('#ff0000')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embedAlerta] });
                }

                console.log(`Spam bloqueado de ${message.author.tag}`);

            } catch (err) {
                console.error('Erro ao processar spam:', err);
            }
        }
    });

    const mensagensRecentes = new Map();

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const userId = message.author.id;
        const content = message.content;
        const now = Date.now();

        if (!mensagensRecentes.has(userId)) {
            mensagensRecentes.set(userId, { count: 1, lastMessage: content, firstTime: now });
            setTimeout(() => mensagensRecentes.delete(userId), 10000);
        } else {
            const dados = mensagensRecentes.get(userId);

            if (dados.lastMessage === content) {
                dados.count++;

                if (dados.count >= 3) {
                    try {
                        await message.member.timeout(2 * 60 * 60 * 1000, 'Raid/Spam repetido');

                        const canal = message.channel;
                        const mensagens = await canal.messages.fetch({ limit: 20 });
                        const doUser = mensagens.filter(m => m.author.id === userId);
                        await canal.bulkDelete(doUser, true).catch(() => {});

                        const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                        if (logChannel) {
                            logChannel.send(`RAID DETETADO: ${message.author.tag} enviou 3+ mensagens iguais. Timeout de 2h aplicado.`);
                        }

                        mensagensRecentes.delete(userId);
                    } catch (err) {
                        console.error('Erro anti-raid:', err);
                    }
                }
            }
        }
    });
}

// ============================================================================
// 5. COMANDO DE PANICO
// ============================================================================

async function handlePanicoCommand(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    if (interaction.commandName !== 'panico') return false;

    const { member, guild } = interaction;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Apenas administradores.', flags: MessageFlags.Ephemeral });
    }

    const modo = interaction.options.getString('modo');

    try {
        const cargoVerificado = await guild.roles.fetch(CONFIG.CARGO_VERIFICADO_ID);

        if (modo === 'on') {
            await cargoVerificado.setPermissions([]);
            await interaction.reply('MODO PANICO ATIVADO! Todos os verificados perderam acesso ao chat.');
        } else {
            await cargoVerificado.setPermissions([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]);
            await interaction.reply('Modo panico desativado. Acesso restaurado.');
        }

    } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'Erro ao alterar permissoes.', flags: MessageFlags.Ephemeral });
    }

    return true;
}

// ============================================================================
// INICIALIZACAO
// ============================================================================

function inicializarSistemaVerificacao(client) {
    setupGuildMemberAdd(client);
    setupAntiSpam(client);
    console.log('Sistema de verificacao e anti-spam inicializado');
}

module.exports = {
    enviarVerificacao,
    handleVerificacaoInteraction,
    handlePanicoCommand,
    inicializarSistemaVerificacao,
    CONFIG,
    usuariosVerificados
};
