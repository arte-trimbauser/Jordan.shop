// src/events/sistemaVerificacao.js - SISTEMA DE VERIFICAÇÃO ANTI-SPAM

const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');

// CONFIGURAÇÕES - ALTERAR ESTES IDs
const CONFIG = {
    CANAL_VERIFICACAO_ID: '1393690238903128115',      // Canal onde fica o botão de verificar
    CANAL_LOGS_ID: '1437076921627181228',                    // Canal de logs (já tens este)
    CARGO_NAO_VERIFICADO_ID: '1393658218722623529',     // Cargo para novos membros
    CARGO_VERIFICADO_ID: '1393658270996234351',             // Cargo que dá acesso à loja
    PALAVRA_CHAVE: 'JORDAN',                                 // Código para verificar
    MINUTO_ESPERA: 0                                         // Minutos de espera antes de verificar (0 = imediato)
};

// ============================================================================
// 1. ENVIAR MENSAGEM DE VERIFICAÇÃO NO CANAL
// ============================================================================

async function enviarVerificacao(client) {
    try {
        const canal = await client.channels.fetch(CONFIG.CANAL_VERIFICACAO_ID);
        if (!canal) {
            console.error('❌ Canal de verificação não encontrado!');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Verificação de Segurança - Jordan Shop')
            .setDescription(
                '**Bem-vindo à Jordan Shop!**\n\n' +
                'Para acederes à loja e garantires que não és um bot de spam, ' +
                'clica no botão abaixo e insere o código de verificação.\n\n' +
                '**Ao verificares, concordas com as regras do servidor.**'
            )
            .setColor('#5865F2')
            .setImage('https://i.postimg.cc/YCmc9zyY/sucesso-no-neg-cio-61850034.webp')
            .setFooter({ text: 'Sistema de Proteção Anti-Bot' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('iniciar_verificacao')
                .setLabel('🔐 Iniciar Verificação')
                .setStyle(ButtonStyle.Success)
        );

        await canal.send({ embeds: [embed], components: [row] });
        console.log('✅ Sistema de verificação enviado');

    } catch (err) {
        console.error('❌ Erro ao enviar verificação:', err.message);
    }
}

// ============================================================================
// 2. QUANDO NOVO MEMBRO ENTRA - DAR CARGO NÃO VERIFICADO
// ============================================================================

function setupGuildMemberAdd(client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            // Verificar idade da conta (anti-bot)
            const contaIdade = Date.now() - member.user.createdAt;
            const dias = contaIdade / (1000 * 60 * 60 * 24);
            
            if (dias < 7) {
                console.log(`⚠️ Conta muito recente: ${member.user.tag} (${dias.toFixed(1)} dias)`);
                // Opcional: Banir ou kickar contas muito recentes
                // await member.kick('Conta criada há menos de 7 dias');
            }

            // Dar cargo de não verificado
            await member.roles.add(CONFIG.CARGO_NAO_VERIFICADO_ID);
            console.log(`✅ ${member.user.tag} entrou e recebeu cargo não verificado`);

            // Enviar DM (opcional)
            try {
                await member.send(
                    '👋 Bem-vindo à Jordan Shop!\n\n' +
                    'Para acederes à loja, passa pela verificação no canal #verificação.\n' +
                    'Isto protege a nossa comunidade contra bots de spam.'
                );
            } catch {
                // DM fechada, ignorar
            }

        } catch (err) {
            console.error('❌ Erro ao processar novo membro:', err);
        }
    });
}

// ============================================================================
// 3. HANDLER DE INTERAÇÕES (BOTÃO E MODAL)
// ============================================================================

async function handleVerificacaoInteraction(interaction, client) {
    const { customId, member, user, guild } = interaction;

    // BOTÃO: Iniciar verificação
    if (customId === 'iniciar_verificacao') {
        
        // Verificar tempo de espera
        const tempoNoServidor = Date.now() - member.joinedAt;
        const minutosNoServidor = tempoNoServidor / (1000 * 60);
        
        if (minutosNoServidor < CONFIG.MINUTO_ESPERA) {
            const minutosRestantes = Math.ceil(CONFIG.MINUTO_ESPERA - minutosNoServidor);
            return interaction.reply({
                content: `⏳ Aguarda ${minutosRestantes} minuto(s) antes de te verificares.`,
                flags: [64]
            });
        }

        // Verificar se já está verificado
        if (member.roles.cache.has(CONFIG.CARGO_VERIFICADO_ID)) {
            return interaction.reply({
                content: '✅ Já estás verificado!',
                flags: [64]
            });
        }

        // Abrir modal
        const modal = new ModalBuilder()
            .setCustomId('modal_verificacao')
            .setTitle('🔐 Verificação Jordan Shop');

        const input = new TextInputBuilder()
            .setCustomId('codigo_verificacao')
            .setLabel(`Insere o código: ${CONFIG.PALAVRA_CHAVE}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Escreve aqui o código...')
            .setRequired(true)
            .setMaxLength(20);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    // MODAL: Verificar código
    if (interaction.isModalSubmit() && customId === 'modal_verificacao') {
        const codigo = interaction.fields.getTextInputValue('codigo_verificacao');

        if (codigo.toUpperCase() === CONFIG.PALAVRA_CHAVE) {
            try {
                // Remover cargo não verificado
                await member.roles.remove(CONFIG.CARGO_NAO_VERIFICADO_ID);
                
                // Adicionar cargo verificado
                await member.roles.add(CONFIG.CARGO_VERIFICADO_ID);

                // Log
                const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                if (logChannel) {
                    const embedLog = new EmbedBuilder()
                        .setTitle('✅ Novo Membro Verificado')
                        .setDescription(`**Utilizador:** <@${user.id}>\n**Conta criada:** <t:${Math.floor(user.createdAt.getTime()/1000)}:R>`)
                        .setColor('#00ff00')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embedLog] });
                }

                return interaction.reply({
                    content: '✅ **Verificação concluída!**\n\nAgora tens acesso à loja. O canal de verificação desaparecerá para ti em breve.',
                    flags: [64]
                });

            } catch (err) {
                console.error('❌ Erro ao trocar cargos:', err);
                return interaction.reply({
                    content: '❌ Erro ao processar verificação. Contacta um administrador.',
                    flags: [64]
                });
            }
        } else {
            return interaction.reply({
                content: '❌ Código incorreto! Tenta novamente.',
                flags: [64]
            });
        }
    }

    return false; // Não processou esta interação
}

// ============================================================================
// 4. SISTEMA ANTI-SPAM (ANTI-LINKS E @EVERYONE)
// ============================================================================

function setupAntiSpam(client) {
    
    // Lista de palavras/links proibidos
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

        // Verificar se é admin (ignorar)
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

        // Verificar @everyone ou @here
        const temEveryone = content.includes('@everyone') || content.includes('@here');
        
        // Verificar links proibidos
        const temLinkProibido = palavrasProibidas.some(palavra => contentLower.includes(palavra));

        if (temEveryone || temLinkProibido) {
            try {
                // Apagar mensagem imediatamente
                await message.delete();

                // Timeout de 1 hora
                await member.timeout(60 * 60 * 1000, 'Spam/Links suspeitos detectados');

                // Retirar cargo verificado (se tiver)
                if (member.roles.cache.has(CONFIG.CARGO_VERIFICADO_ID)) {
                    await member.roles.remove(CONFIG.CARGO_VERIFICADO_ID);
                    await member.roles.add(CONFIG.CARGO_NAO_VERIFICADO_ID);
                }

                // Log
                const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                if (logChannel) {
                    const embedAlerta = new EmbedBuilder()
                        .setTitle('🚨 SPAM DETETADO E BLOQUEADO')
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

                console.log(`🚨 Spam bloqueado de ${message.author.tag}`);

            } catch (err) {
                console.error('❌ Erro ao processar spam:', err);
            }
        }
    });

    // Anti-raid (muitas mensagens iguais)
    const mensagensRecentes = new Map(); // userId -> { count, lastMessage, timer }

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const userId = message.author.id;
        const content = message.content;
        const now = Date.now();

        if (!mensagensRecentes.has(userId)) {
            mensagensRecentes.set(userId, { count: 1, lastMessage: content, firstTime: now });
            
            // Limpar após 10 segundos
            setTimeout(() => mensagensRecentes.delete(userId), 10000);
        } else {
            const dados = mensagensRecentes.get(userId);
            
            if (dados.lastMessage === content) {
                dados.count++;
                
                // Se enviou 3 mensagens iguais em 10 segundos
                if (dados.count >= 3) {
                    try {
                        await message.member.timeout(2 * 60 * 60 * 1000, 'Raid/Spam repetido'); // 2 horas
                        
                        // Apagar todas as mensagens recentes deste user (simplificado)
                        const canal = message.channel;
                        const mensagens = await canal.messages.fetch({ limit: 20 });
                        const doUser = mensagens.filter(m => m.author.id === userId);
                        await canal.bulkDelete(doUser, true).catch(() => {});

                        const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_ID).catch(() => null);
                        if (logChannel) {
                            logChannel.send(`🚨 **RAID DETETADO:** ${message.author.tag} enviou 3+ mensagens iguais. Timeout de 2h aplicado.`);
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
// 5. COMANDO DE PANICO (BLOQUEAR TODOS)
// ============================================================================

async function handlePanicoCommand(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    if (interaction.commandName !== 'panico') return false;

    const { member, guild } = interaction;
    
    // Verificar se é admin
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Apenas administradores.', flags: [64] });
    }

    const modo = interaction.options.getString('modo');

    try {
        const cargoVerificado = await guild.roles.fetch(CONFIG.CARGO_VERIFICADO_ID);
        
        if (modo === 'on') {
            // Desativar permissão de falar no cargo verificado
            await cargoVerificado.setPermissions([]);
            await interaction.reply('🚨 **MODO PÂNICO ATIVADO!** Todos os verificados perderam acesso ao chat.');
        } else {
            // Restaurar permissões básicas
            await cargoVerificado.setPermissions([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]);
            await interaction.reply('✅ **Modo pânico desativado.** Acesso restaurado.');
        }

    } catch (err) {
        console.error(err);
        interaction.reply('❌ Erro ao alterar permissões.', flags: [64]);
    }

    return true;
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

function inicializarSistemaVerificacao(client) {
    setupGuildMemberAdd(client);
    setupAntiSpam(client);
    console.log('✅ Sistema de verificação e anti-spam inicializado');
}

module.exports = {
    enviarVerificacao,
    handleVerificacaoInteraction,
    handlePanicoCommand,
    inicializarSistemaVerificacao,
    CONFIG
};
