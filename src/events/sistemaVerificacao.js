// src/events/sistemaVerificacao.js - SISTEMA DE VERIFICACAO COM SUPABASE
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

// ========== CRIAR CLIENTE SUPABASE DIRETAMENTE ==========
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL ou SUPABASE_KEY não definidas no ambiente!');
} else {
    console.log('✅ Supabase configurado com sucesso.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =========================================================

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

// ================= FUNÇÕES SUPABASE =================
async function getVerificacaoAtiva() {
    try {
        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Supabase não configurado. A usar true por segurança.');
            return true;
        }

        const { data, error } = await supabase
            .from('config')
            .select('verificacao_ativa')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('❌ Erro ao ler verificacao_ativa do Supabase:', error.message);
            console.error('Detalhes:', error);
            return true; // fallback para verdadeiro
        }

        if (!data) {
            console.warn('⚠️ Nenhum registo encontrado na tabela config. A criar registo padrão...');
            // Tentar criar o registo
            const { error: insertError } = await supabase
                .from('config')
                .insert({ id: 1, verificacao_ativa: true });
            if (insertError) {
                console.error('❌ Erro ao criar registo config:', insertError.message);
            }
            return true;
        }

        console.log(`📊 Estado da verificação lido da BD: ${data.verificacao_ativa}`);
        return data.verificacao_ativa;

    } catch (err) {
        console.error('❌ Exceção ao ler verificacao_ativa:', err.message);
        return true;
    }
}

async function setVerificacaoAtiva(valor) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Supabase não configurado. Não foi possível guardar estado.');
            return;
        }

        const { error } = await supabase
            .from('config')
            .update({ verificacao_ativa: valor, updated_at: new Date() })
            .eq('id', 1);

        if (error) {
            console.error('❌ Erro ao atualizar estado da verificação:', error.message);
        } else {
            console.log(`✅ Estado da verificação atualizado para: ${valor}`);
        }
    } catch (err) {
        console.error('❌ Exceção ao guardar verificacao_ativa:', err.message);
    }
}
// ===================================================

// ================= COMANDO /verificacao =================
const comandoVerificacao = new SlashCommandBuilder()
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

async function registrarComandoVerificacao(client) {
    try {
        const guild = await client.guilds.fetch("1393629457599828040");
        await guild.commands.create(comandoVerificacao);
        console.log('✅ Comando /verificacao registado');
    } catch (err) {
        console.error('❌ Erro ao registar /verificacao:', err);
    }
}

// ================= ENVIAR EMBED DE VERIFICAÇÃO =================
let mensagemVerificacaoEnviada = false;

async function enviarVerificacao(client) {
    try {
        // 1. Verifica o estado na base de dados
        const ativa = await getVerificacaoAtiva();
        if (!ativa) {
            console.log('ℹ️ Verificacao desativada na BD. Não vou enviar a mensagem.');
            return;
        }

        if (mensagemVerificacaoEnviada) {
            console.log('ℹ️ Mensagem já enviada nesta sessão.');
            return;
        }

        const canal = await client.channels.fetch(CONFIG.CANAL_VERIFICACAO_ID);
        if (!canal) {
            console.error('❌ Canal de verificacao não encontrado!');
            return;
        }

        // Verifica se já existe mensagem do bot no canal
        const mensagens = await canal.messages.fetch({ limit: 20 });
        const jaExiste = mensagens.some(m => 
            m.author.id === client.user.id && 
            m.components.length > 0 &&
            m.embeds.length > 0 &&
            m.embeds[0].title &&
            m.embeds[0].title.includes('Verificacao')
        );

        if (jaExiste) {
            console.log('ℹ️ Mensagem de verificacao já existe no canal. Duplicado evitado.');
            mensagemVerificacaoEnviada = true;
            return;
        }

        // Cria e envia
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
        mensagemVerificacaoEnviada = true;
        console.log('✅ Mensagem de verificação enviada com sucesso.');

    } catch (err) {
        console.error('❌ Erro ao enviar verificacao:', err.message);
    }
}

// ================= EVENTO GUILD MEMBER ADD =================
let guildMemberAddListener = null;

function setupGuildMemberAdd(client) {
    if (guildMemberAddListener) {
        client.removeListener('guildMemberAdd', guildMemberAddListener);
    }

    guildMemberAddListener = async (member) => {
        const ativa = await getVerificacaoAtiva();
        if (!ativa) {
            console.log(`ℹ️ Verificacao desativada - ${member.user.tag} entrou sem verificacao`);
            return;
        }

        try {
            await member.roles.add(CONFIG.CARGO_NAO_VERIFICADO_ID);
            console.log(`✅ ${member.user.tag} recebeu cargo não verificado`);

            try {
                await member.send(`Bem-vindo a Jordan Shop!

Para acederes a loja, passa pela verificacao no canal #verificacao.
Isto protege a nossa comunidade contra bots de spam.`);
            } catch {}
        } catch (err) {
            console.error('❌ Erro ao processar novo membro:', err);
        }
    };

    client.on('guildMemberAdd', guildMemberAddListener);

    client.on('guildMemberRemove', (member) => {
        usuariosComModalAberto.delete(member.user.id);
        usuariosVerificados.delete(member.user.id);
    });
}

// ================= HANDLER DE INTERAÇÃO =================
async function handleVerificacaoInteraction(interaction, client) {
    const { customId, member, user, commandName } = interaction;

    if (interaction.isChatInputCommand() && commandName === 'verificacao') {
        const estado = interaction.options.getString('estado');
        const novoValor = (estado === 'ativar');

        await setVerificacaoAtiva(novoValor);

        const embed = new EmbedBuilder()
            .setColor(novoValor ? 0x00FF00 : 0xFF0000)
            .setTitle(novoValor ? '✅ Verificacao Ativada' : '❌ Verificacao Desativada')
            .setDescription(novoValor 
                ? 'O sistema de verificacao de novos membros foi **ativado**.\n\nNovos membros terao de se verificar para aceder ao servidor.'
                : 'O sistema de verificacao de novos membros foi **desativado**.\n\nNovos membros terao acesso automatico ao servidor.')
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return true;
    }

    if (customId === 'iniciar_verificacao') {
        const ativa = await getVerificacaoAtiva();
        if (!ativa) {
            return interaction.reply({
                content: '⚠️ O sistema de verificacao esta desativado. Podes aceder ao servidor normalmente.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (member.roles.cache.has(CONFIG.CARGO_VERIFICADO_ID)) {
            return interaction.reply({
                content: '✅ Ja estas verificado!',
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
                        .setDescription(`**Utilizador:** <@${user.id}> (${user.username})`)
                        .setColor('#00ff00')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embedLog] });
                }

                return interaction.reply({
                    content: '✅ Verificacao concluida! Agora tens acesso a loja.',
                    flags: MessageFlags.Ephemeral
                });

            } catch (err) {
                console.error('❌ Erro ao trocar cargos:', err);
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
        const { member, content } = message;
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const contentLower = content.toLowerCase();
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
                        .setDescription(`**Utilizador:** <@${message.author.id}>\n**Motivo:** Spam/Link proibido\n**Mensagem:** ${content.slice(0, 100)}`)
                        .setColor('#ff0000')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('❌ Erro no anti-spam:', err);
            }
        }
    });
}

function inicializarSistemaVerificacao(client) {
    setupGuildMemberAdd(client);
    setupAntiSpam(client);
    registrarComandoVerificacao(client);
    console.log('✅ Sistema de verificacao inicializado');
}

module.exports = {
    comandoVerificacao,
    enviarVerificacao,
    inicializarSistemaVerificacao,
    handleVerificacaoInteraction
};
