// src/commands/idcanais.js
const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

// ============================================================
// MAPA: ID do canal/cargo → descrição + onde é usado
// ============================================================
const DESCRICOES = {
    // ===== CANAIS =====
    "1521916593402286191": {
        nome: "📋 Logs de Tickets (aceitar/assumir/chamar)",
        usado: "interactionCreate.js → CANAL_TICKETS_LOGS",
        tipo: "canal"
    },
    "1424461544317517854": {
        nome: "📄 Transcripts Arquivados",
        usado: "sendTranscript.js → TRANSCRIPT_CHANNEL_ID",
        tipo: "canal"
    },
    "1393689118717771786": {
        nome: "🛒 Registo de Vendas",
        usado: "interactionCreate.js → modal_venda_fechamento",
        tipo: "canal"
    },
    "1437076921627181228": {
        nome: "📢 Logs do Staff (recusar termos, /chamar, anti-spam, arranque)",
        usado: "config.STAFF_LOGS_CHANNEL_ID, chamarCommand.js, messageCreate.js, ready.js, sistemaVerificacao.js",
        tipo: "canal"
    },
    "1493942678612869311": {
        nome: "🎫 Painel de Suporte (menu multilíngue)",
        usado: "sistemaCompleto.js → CANAL_TICKET_ID",
        tipo: "canal"
    },
    "1490783323780419664": {
        nome: "📋 Centro de Feedback (bug/ideia/avaliar)",
        usado: "sistemaCompleto.js → CANAL_FORMULARIO_ID",
        tipo: "canal"
    },
    "1492521949736472757": {
        nome: "🔊 Canal de Voz (música loop)",
        usado: "sistemaCompleto.js → CANAL_VOZ_ID",
        tipo: "canal"
    },
    "1393690238903128115": {
        nome: "🛡️ Verificação (código JORDAN)",
        usado: "sistemaVerificacao.js → CANAL_VERIFICACAO_ID",
        tipo: "canal"
    },

    // ===== CATEGORIAS =====
    "1457415165380268134": {
        nome: "📁 Categoria Geral (tickets normais)",
        usado: "interactionCreate.js → CATEGORIA_GERAL",
        tipo: "categoria"
    },
    "1490783459470475414": {
        nome: "📁 Categoria Especial (VPN — fecha direto)",
        usado: "interactionCreate.js → CATEGORIA_ESPECIAL / CATEGORIA_SEM_VENDA",
        tipo: "categoria"
    },
    "1393629457599828040": {
        nome: "🏠 Servidor (Guild ID)",
        usado: "GUILD_ID em vários ficheiros",
        tipo: "servidor"
    },

    // ===== CARGOS =====
    "1393658593131233421": {
        nome: "👑 Owner",
        usado: "config.STAFF_ROLES[0] (env OWNER_ROLE_ID)",
        tipo: "cargo"
    },
    "1447241549489639661": {
        nome: "💻 Developer",
        usado: "config.STAFF_ROLES[1] (env DEVELOPER_ROLE_ID)",
        tipo: "cargo"
    },
    "1421595512477450373": {
        nome: "🎧 Suporte",
        usado: "config.STAFF_ROLES[2] (env SUPPORT_ROLE_ID)",
        tipo: "cargo"
    },
    "1393658417884823662": {
        nome: "🛠️ Moderador",
        usado: "config.STAFF_ROLES[3] + deteção no modal_venda",
        tipo: "cargo"
    },
    "1393658313006383176": {
        nome: "🛡️ Staff",
        usado: "config.STAFF_ROLES[4] + deteção no modal_venda",
        tipo: "cargo"
    },
    "1393658270996234351": {
        nome: "✅ Verificado",
        usado: "sistemaVerificacao.js → CARGO_VERIFICADO_ID",
        tipo: "cargo"
    },
    "1393658218722623529": {
        nome: "⏳ Não Verificado",
        usado: "sistemaVerificacao.js → CARGO_NAO_VERIFICADO_ID",
        tipo: "cargo"
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("idcanais")
        .setDescription("📋 Lista todos os IDs de canais/cargos e para que servem")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        await interaction.deferReply({ flags: 64 });

        const guild = interaction.guild;

        // ============ EMBED 1: CANAIS E CATEGORIAS IMPORTANTES ============
        const embedImportantes = new EmbedBuilder()
            .setTitle("📋 Canais & Categorias Importantes")
            .setDescription("Aqui estão os IDs que o **bot** usa no código, por ordem de importância.")
            .setColor("#8b0000")
            .setFooter({ text: "Jordan Shop | Canais do Sistema" });

        const canaisImportantes = [
            "1521916593402286191",
            "1424461544317517854",
            "1393689118717771786",
            "1437076921627181228",
            "1493942678612869311",
            "1490783323780419664",
            "1492521949736472757",
            "1393690238903128115"
        ];

        for (const id of canaisImportantes) {
            const info = DESCRICOES[id];
            const canal = guild.channels.cache.get(id);
            if (!canal) {
                embedImportantes.addFields({
                    name: `❌ ${id} (não existe)`,
                    value: `**Função:** ${info.nome}\n**Onde é usado:** \`${info.usado}\``
                });
                continue;
            }
            embedImportantes.addFields({
                name: `${info.nome} — <#${id}>`,
                value: `**ID:** \`${id}\`\n**Onde é usado:** \`${info.usado}\``
            });
        }

        await interaction.editReply({ embeds: [embedImportantes] });

        // ============ EMBED 2: CATEGORIAS ============
        const embedCategorias = new EmbedBuilder()
            .setTitle("📁 Categorias do Sistema")
            .setColor("#8b0000");

        const categoriasImportantes = [
            "1457415165380268134",
            "1490783459470475414"
        ];

        for (const id of categoriasImportantes) {
            const info = DESCRICOES[id];
            const cat = guild.channels.cache.get(id);
            const nome = cat ? cat.name : "(não encontrada)";
            embedCategorias.addFields({
                name: `📁 ${nome}`,
                value: `**ID:** \`${id}\`\n**Função:** ${info.nome}\n**Onde é usado:** \`${info.usado}\``
            });
        }

        await interaction.followUp({ embeds: [embedCategorias], flags: 64 });

        // ============ EMBED 3: CARGOS ============
        const embedCargos = new EmbedBuilder()
            .setTitle("🎭 Cargos do Sistema")
            .setColor("#8b0000");

        const cargosImportantes = [
            "1393658593131233421",
            "1447241549489639661",
            "1421595512477450373",
            "1393658417884823662",
            "1393658313006383176",
            "1393658270996234351",
            "1393658218722623529"
        ];

        for (const id of cargosImportantes) {
            const info = DESCRICOES[id];
            const cargo = guild.roles.cache.get(id);
            const nome = cargo ? cargo.name : "(não encontrado)";
            embedCargos.addFields({
                name: `${info.nome} — @${nome}`,
                value: `**ID:** \`${id}\`\n**Onde é usado:** \`${info.usado}\``
            });
        }

        await interaction.followUp({ embeds: [embedCargos], flags: 64 });

        // ============ EMBED 4: CARGOS EXTRA (env vars) ============
        const embedEnv = new EmbedBuilder()
            .setTitle("⚙️ Variáveis de Ambiente (Render)")
            .setDescription("Verifica estas no painel do Render → Environment:")
            .addFields(
                { name: "🆔 GUILD_ID", value: process.env.GUILD_ID ? `\`${process.env.GUILD_ID}\`` : "❌ Não definida", inline: false },
                { name: "📢 LOG_CHANNEL_ID", value: process.env.LOG_CHANNEL_ID ? `\`${process.env.LOG_CHANNEL_ID}\`` : "❌ Não definida (usa default)", inline: false },
                { name: "🗂️ CATEGORY_ID", value: process.env.CATEGORY_ID ? `\`${process.env.CATEGORY_ID}\`` : "❌ Não definida", inline: false },
                { name: "👑 OWNER_ROLE_ID", value: process.env.OWNER_ROLE_ID ? `\`${process.env.OWNER_ROLE_ID}\`` : "❌ Não definida (usa default)", inline: false },
                { name: "💻 DEVELOPER_ROLE_ID", value: process.env.DEVELOPER_ROLE_ID ? `\`${process.env.DEVELOPER_ROLE_ID}\`` : "❌ Não definida (usa default)", inline: false },
                { name: "🎧 SUPPORT_ROLE_ID", value: process.env.SUPPORT_ROLE_ID ? `\`${process.env.SUPPORT_ROLE_ID}\`` : "❌ Não definida (usa default)", inline: false },
                { name: "🗄️ SUPABASE_URL", value: process.env.SUPABASE_URL ? `\`${process.env.SUPABASE_URL}\`` : "❌ Não definida", inline: false },
                { name: "🔑 SUPABASE_KEY", value: process.env.SUPABASE_KEY ? "✅ Definida (oculta)" : "❌ Não definida", inline: false },
                { name: "🤖 DISCORD_TOKEN", value: process.env.DISCORD_TOKEN ? "✅ Definida (oculta)" : "❌ Não definida", inline: false }
            )
            .setColor("#8b0000")
            .setFooter({ text: "Jordan Shop | Environment Variables" });

        await interaction.followUp({ embeds: [embedEnv], flags: 64 });
    }
};
