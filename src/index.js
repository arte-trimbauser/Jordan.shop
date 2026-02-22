require("dotenv").config({ path: "./.env" });
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ], 
  partials: [Partials.Channel] 
});

const readyEvent = require("./events/ready");
const errorEvent = require("./events/error");
const interactionCreateEvent = require("./events/interactionCreate");

// Registo de Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Conversa com a IA do Jordan Shop')
    .addStringOption(option => 
      option.setName('mensagem')
        .setDescription('O que queres perguntar?')
        .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once("ready", async () => {
  try {
    console.log('🔄 A atualizar comandos slash (/)');
    // Isto regista os comandos globalmente
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✅ Comandos slash registados!');
    readyEvent(client);
  } catch (error) {
    console.error("❌ Erro ao registar comandos:", error);
  }
});

errorEvent(client);
interactionCreateEvent(client);

const app = express();
app.get("/healthz", (req, res) => res.send("OK"));
app.listen(process.env.PORT || 10000, () => console.log("🌐 Servidor web ativo"));

client.login(process.env.DISCORD_TOKEN);
