require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");

const client = new Client({ intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], partials:[Partials.Channel] });

const readyEvent = require("./events/ready");
const errorEvent = require("./events/error");

client.once("ready", () => readyEvent(client));
errorEvent(client);

// Express
const app = express();
app.get("/healthz",(req,res)=>res.send("OK"));
app.listen(process.env.PORT||10000, ()=>console.log("🌐 Servidor web ativo") );

client.login(process.env.DISCORD_TOKEN);
