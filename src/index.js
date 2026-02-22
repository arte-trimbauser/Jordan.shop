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

// Importação dos Eventos
const readyEvent = require("./events/ready");
const errorEvent = require("./events/error");
const interactionCreateEvent = require("./events/interactionCreate");

// --- REGISTO DE COMANDOS SLASH ---
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
    console.log('🔄 A registar comandos slash (/) no Discord...');
    
    // Regista os comandos para o ID do bot que está logado
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    
    console.log('✅ Comandos slash registados com sucesso!');
    readyEvent(client); // Chama o teu evento ready original
  } catch (error) {
    console.error("❌ Erro ao registar comandos:", error);
  }
});

// Ativação dos outros eventos
errorEvent(client);
interactionCreateEvent(client);

// Servidor Web para o Render
const app = express();
app.get("/healthz", (req, res) => res.send("OK"));
app.listen(process.env.PORT || 10000, () => console.log("🌐 Servidor web ativo na porta " + (process.env.PORT || 10000)));

client.login(process.env.DISCORD_TOKEN);
