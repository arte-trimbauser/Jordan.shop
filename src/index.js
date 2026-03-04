require("dotenv").config({ path: "./.env" });
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const path = require("path");
const fs = require("fs");

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
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Comandos slash registados!');
    readyEvent(client);
  } catch (error) {
    console.error("❌ Erro nos comandos:", error);
  }
});

errorEvent(client);
interactionCreateEvent(client);

// --- SERVIDOR WEB ---
const app = express();
// Caminho absoluto para a pasta de transcritos
const transcriptsPath = path.resolve(__dirname, 'transcripts');

if (!fs.existsSync(transcriptsPath)) {
    fs.mkdirSync(transcriptsPath, { recursive: true });
}

// Servir ficheiros para o site
app.use('/transcripts', express.static(transcriptsPath));

// API para o site listar os ficheiros
app.get('/api/transcripts', (req, res) => {
    const ficheiros = fs.readdirSync(transcriptsPath).filter(f => f.endsWith('.html'));
    res.json(ficheiros);
});

app.get("/healthz", (req, res) => res.send("OK"));

app.listen(process.env.PORT || 10000, () => {
    console.log("🌐 Site/API ativo na porta " + (process.env.PORT || 10000));
});

client.login(process.env.DISCORD_TOKEN);
