require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");

// Cria o client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ], 
  partials: [Partials.Channel] 
});

// Eventos
const readyEvent = require("./events/ready");
const errorEvent = require("./events/error");
const interactionCreateEvent = require("./events/interactionCreate");

// Ativa eventos
client.once("ready", () => readyEvent(client));
errorEvent(client);
interactionCreateEvent(client); // <- aqui, passa o client

// Express
const app = express();
app.get("/healthz", (req, res) => res.send("OK"));
app.listen(process.env.PORT || 10000, () => console.log("🌐 Servidor web ativo") );

// Login
client.login(process.env.DISCORD_TOKEN);
