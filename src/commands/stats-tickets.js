// src/commands/stats-tickets.js
const { SlashCommandBuilder } = require("discord.js");
const { mostrarEstatisticas } = require("../helpers/ticketLogs");
const isStaff = require("../helpers/isStaff");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats-tickets")
        .setDescription("📊 Mostra as estatísticas globais de tickets (Staff Only)"),

    async execute(interaction, client) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: "❌ Apenas Staff.", flags: 64 });
        }
        await interaction.reply({ content: "📊 A enviar estatísticas...", flags: 64 });
        await mostrarEstatisticas(client);
    }
};
