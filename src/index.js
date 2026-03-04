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
    console.log('🔄 A registar comandos slash (/) no Discord...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✅ Comandos slash registados com sucesso!');
    readyEvent(client);
  } catch (error) {
    console.error("❌ Erro ao registar comandos:", error);
  }
});

// Ativação dos outros eventos
errorEvent(client);
interactionCreateEvent(client);

// --- SERVIDOR WEB (PARA O RENDER E SITE) ---
const app = express();

// 1. Torna a pasta de transcripts acessível (onde o bot guarda os ficheiros)
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));

// 2. API que o teu site consulta para listar os logs
app.get('/api/transcripts', (req, res) => {
    const pasta = path.join(__dirname, 'transcripts');
    if (!fs.existsSync(pasta)) return res.json([]);
    
    // Lê os ficheiros .html da pasta e manda a lista para o site
    const ficheiros = fs.readdirSync(pasta).filter(f => f.endsWith('.html'));
    res.json(ficheiros);
});

// 3. Health Check para o Render não deixar o bot dormir
app.get("/healthz", (req, res) => res.send("OK"));

const PORTA = process.env.PORT || 10000;
app.listen(PORTA, () => {
    console.log(`🌐 Servidor web ativo na porta ${PORTA}`);
});

client.login(process.env.DISCORD_TOKEN);
