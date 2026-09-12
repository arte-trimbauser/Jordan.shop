// src/helpers/ticketLogs.js
const { EmbedBuilder } = require("discord.js");

// Canal onde os logs de tickets vão ser enviados
const CANAL_LOGS_TICKETS = "1521916593402286191";

// ============ IDs A IGNORAR NAS ESTATÍSTICAS ============
// Tickets abertos por estes IDs NÃO contam para:
//   - Total de "Abertos"
//   - Contagem por produto
// (Continuam a ser logados no canal, só não inflacionam as stats)
const IGNORAR_ABERTOS_POR = [
    "996454465555136675", // Jordan (tu)
];

// ============ ESTATÍSTICAS EM MEMÓRIA ============
const stats = {
    totalAbertos: 0,
    totalAssumidos: 0,
    totalFechados: 0,
    totalVendas: 0,
    staffStats: new Map(),   // staffId -> { nome, assumidos, fechados, vendas }
    produtos: new Map()      // produto -> count
};

function getStaffEntry(id, nome) {
    if (!stats.staffStats.has(id)) {
        stats.staffStats.set(id, { nome: nome || "Desconhecido", assumidos: 0, fechados: 0, vendas: 0 });
    }
    const e = stats.staffStats.get(id);
    if (nome) e.nome = nome;
    return e;
}

async function getCanal(client) {
    return client.channels.fetch(CANAL_LOGS_TICKETS).catch(() => null);
}

// ===================== ABERTURA =====================
async function logTicketAberto(client, { canal, user, produto, metodo }) {
    const ignorarStats = IGNORAR_ABERTOS_POR.includes(user.id);

    if (!ignorarStats) {
        stats.totalAbertos++;
        const chaveProd = String(produto || "Desconhecido");
        stats.produtos.set(chaveProd, (stats.produtos.get(chaveProd) || 0) + 1);
    }

    const canalLogs = await getCanal(client);
    if (!canalLogs) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Jordan Shop | Sistema de Tickets", iconURL: client.user.displayAvatarURL() })
        .setTitle("🎫 Novo Ticket Aberto")
        .setColor("#3498db")
        .setDescription(
            `**👤 Aberto por:** ${user.username}\n` +
            `**📦 Produto:** \`${produto}\`\n` +
            `**💳 Método:** ${metodo}\n` +
            `**📁 Canal:** <#${canal.id}>\n` +
            `**🕐 Data:** <t:${Math.floor(Date.now() / 1000)}:F>`
            + (ignorarStats ? `\n\n⚠️ *Ticket de teste/staff — não conta nas estatísticas.*` : "")
        )
        .setFooter({
            text: ignorarStats
                ? "📊 Ticket ignorado nas estatísticas"
                : `📊 Total de tickets abertos: ${stats.totalAbertos}`
        })
        .setTimestamp();

    await canalLogs.send({ embeds: [embed] }).catch(() => {});
}

// ===================== ASSUMIR =====================
async function logTicketAssumido(client, { canal, staff, user, produto, metodo }) {
    stats.totalAssumidos++;
    const nomeStaff = staff.displayName || staff.user.username;
    const entry = getStaffEntry(staff.id, nomeStaff);
    entry.assumidos++;

    const canalLogs = await getCanal(client);
    if (!canalLogs) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Jordan Shop | Sistema de Tickets", iconURL: client.user.displayAvatarURL() })
        .setTitle("🛡️ Ticket Assumido")
        .setColor("#57f287")
        .setDescription(
            `**🧑‍💼 Staff:** ${nomeStaff}\n` +
            `**👤 Cliente:** ${user.username}\n` +
            `**📦 Produto:** \`${produto}\`\n` +
            `**💳 Método:** ${metodo}\n` +
            `**📁 Canal:** <#${canal.id}>\n` +
            `**🕐 Data:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setFooter({ text: `📊 ${nomeStaff} já assumiu ${entry.assumidos} ticket(s)` })
        .setTimestamp();

    await canalLogs.send({ embeds: [embed] }).catch(() => {});
}

// ===================== FECHO =====================
async function logTicketFechado(client, { canal, staff, user, produto, metodo, venda }) {
    stats.totalFechados++;
    const nomeStaff = staff.displayName || staff.user.username;
    const entry = getStaffEntry(staff.id, nomeStaff);
    entry.fechados++;
    if (venda) {
        stats.totalVendas++;
        entry.vendas++;
    }

    const canalLogs = await getCanal(client);
    if (!canalLogs) return;

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Jordan Shop | Sistema de Tickets", iconURL: client.user.displayAvatarURL() })
        .setTitle(venda ? "💰 Ticket Fechado — Com Venda" : "🔒 Ticket Fechado")
        .setColor(venda ? "#f1c40f" : "#ed4245")
        .setDescription(
            `**🧑‍💼 Fechado por:** ${nomeStaff}\n` +
            `**👤 Cliente:** ${user.username}\n` +
            `**📦 Produto:** \`${produto}\`\n` +
            `**💳 Método:** ${metodo}\n` +
            `**💰 Venda:** ${venda ? "✅ Sim" : "❌ Não"}\n` +
            `**📁 Canal:** <#${canal.id}>\n` +
            `**🕐 Data:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setFooter({ text: `📊 Total: ${stats.totalFechados} fechados | ${stats.totalVendas} vendas` })
        .setTimestamp();

    await canalLogs.send({ embeds: [embed] }).catch(() => {});
}

// ===================== ESTATÍSTICAS =====================
async function mostrarEstatisticas(client) {
    const canalLogs = await getCanal(client);
    if (!canalLogs) return;

    const topStaff = [...stats.staffStats.entries()]
        .sort((a, b) => b[1].assumidos - a[1].assumidos)
        .slice(0, 5)
        .map(([, s], i) => `**${i + 1}.** ${s.nome} — 🛡️ \`${s.assumidos}\` | 🔒 \`${s.fechados}\` | 💰 \`${s.vendas}\``)
        .join("\n") || "`Sem dados ainda`";

    const topProdutos = [...stats.produtos.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([p, c], i) => `**${i + 1}.** \`${p}\` — **${c}** tickets`)
        .join("\n") || "`Sem dados ainda`";

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Jordan Shop | Estatísticas", iconURL: client.user.displayAvatarURL() })
        .setTitle("📊 Estatísticas Globais de Tickets")
        .setColor("#8b0000")
        .addFields(
            { name: "🎫 Abertos", value: `\`${stats.totalAbertos}\``, inline: true },
            { name: "🛡️ Assumidos", value: `\`${stats.totalAssumidos}\``, inline: true },
            { name: "🔒 Fechados", value: `\`${stats.totalFechados}\``, inline: true },
            { name: "💰 Vendas", value: `\`${stats.totalVendas}\``, inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "🏆 Top Staff (assumidos / fechados / vendas)", value: topStaff, inline: false },
            { name: "🔥 Produtos Mais Pedidos", value: topProdutos, inline: false }
        )
        .setFooter({
            text: `Estatísticas desde o último reinício • ${IGNORAR_ABERTOS_POR.length} ID(s) ignorado(s) na abertura`
        })
        .setTimestamp();

    await canalLogs.send({ embeds: [embed] });
}

module.exports = {
    logTicketAberto,
    logTicketAssumido,
    logTicketFechado,
    mostrarEstatisticas,
    stats,
    CANAL_LOGS_TICKETS,
    IGNORAR_ABERTOS_POR
};
