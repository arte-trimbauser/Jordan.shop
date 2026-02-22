require("dotenv").config({ path: "./.env" }); // Garante a leitura do .env na raiz
const { Client, GatewayIntentBits, Partials } = require("discord.js");
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

// Ativação dos Eventos
client.once("ready", () => readyEvent(client));
errorEvent(client);
interactionCreateEvent(client);

// Servidor Web (para manter o bot vivo no Replit/Render)
const app = express();
app.get("/healthz", (req, res) => res.send("OK"));
app.listen(process.env.PORT || 10000, () => console.log("🌐 Servidor web ativo"));

client.login(process.env.DISCORD_TOKEN);
