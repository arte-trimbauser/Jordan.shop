const {
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
StringSelectMenuBuilder
} = require("discord.js");

const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");

const staffCooldown = new Map();
const STAFF_WAIT = 5 * 60 * 1000;

async function sendTranscript(channel,userTag){

const pastaTranscripts = path.join(__dirname,"../../transcripts");

if(!fs.existsSync(pastaTranscripts)){
fs.mkdirSync(pastaTranscripts,{recursive:true});
}

const attachment = await discordTranscripts.createTranscript(channel,{
limit:-1,
filename:`ticket-${channel.name}.html`,
saveImages:true,
poweredBy:false
});

const nome=`ticket-${channel.name}.html`.replace(/\s+/g,"_");
const caminho=path.join(pastaTranscripts,nome);

fs.writeFileSync(caminho,attachment.attachment);

const messages = await channel.messages.fetch({limit:-1});

let txt="";

messages.reverse().forEach(m=>{
txt+=`${m.author.tag}: ${m.content}\n`;
});

fs.writeFileSync(
path.join(pastaTranscripts,`ticket-${channel.name}.txt`),
txt
);

const logChannel = await channel.guild.channels.fetch(config.TRANSCRIPT_LOG_CHANNEL_ID).catch(()=>null);

if(logChannel){

const embed = new EmbedBuilder()
.setTitle("📄 Transcrição Arquivada")
.setDescription(`Canal: ${channel.name}\nFechado por: ${userTag}`)
.setColor("#ff0000");

await logChannel.send({
embeds:[embed],
files:[attachment]
});

}

}

module.exports = async(client)=>{

client.on("interactionCreate",async interaction=>{

try{

const {channel,user,member,customId:cid}=interaction;

if(interaction.isStringSelectMenu() && cid==="menu_ticket"){

const tipo=interaction.values[0];

let category = interaction.guild.channels.cache.find(
c=>c.name===config.CATEGORY_NAME && c.type===4
);

if(!category){
category=await interaction.guild.channels.create({
name:config.CATEGORY_NAME,
type:4
});
}

const canal = await interaction.guild.channels.create({
name:`ticket-${tipo}-${user.username}`.toLowerCase(),
parent:category.id,
topic:user.id,
permissionOverwrites:[
{ id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{ id:user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},
...config.STAFF_ROLES.map(id=>({
id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
}))
]
});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("Reivindicar")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("call_staff")
.setLabel("🔔 Chamar Staff")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Fechar")
.setStyle(ButtonStyle.Danger)

);

await canal.send({
content:`<@${user.id}> obrigado(a) por criar um ticket, em breve algum staff te ajudara.`,
components:[row]
});

return interaction.reply({
content:`Ticket criado: <#${canal.id}>`,
ephemeral:true
});

}

if(interaction.isButton() && cid==="claim_ticket"){

await interaction.update({

content:`Ticket reivindicado por <@${user.id}>`,

components:[
new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("Reivindicado")
.setStyle(ButtonStyle.Success)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("call_staff")
.setLabel("🔔 Chamar Staff")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Fechar")
.setStyle(ButtonStyle.Danger)

)
]

});

}

if(interaction.isButton() && cid==="call_staff"){

const isDev = config.DEV_IDS.includes(user.id);

if(!isDev){

const last=staffCooldown.get(user.id);

if(last && Date.now()-last<STAFF_WAIT){

const remaining=Math.ceil((STAFF_WAIT-(Date.now()-last))/60000);

return interaction.reply({
content:`faltam ${remaining} minutos até poder chamar staff novamente.`,
ephemeral:true
});

}

staffCooldown.set(user.id,Date.now());

}

const options=config.STAFF_MEMBERS.map(s=>({
label:s.label,
value:s.id
}));

const select = new StringSelectMenuBuilder()
.setCustomId("select_staff")
.setPlaceholder("Seleciona o staff")
.addOptions(options);

return interaction.reply({
content:"Seleciona o staff que queres chamar:",
components:[new ActionRowBuilder().addComponents(select)],
ephemeral:true
});

}

if(interaction.isStringSelectMenu() && cid==="select_staff"){

const staffId=interaction.values[0];

await channel.send(`🔔 <@${staffId}> foi chamado por <@${user.id}>`);

return interaction.update({
content:"staff chamado.",
components:[]
});

}

if(interaction.isButton() && cid==="close_ticket"){

const messages = await channel.messages.fetch({limit:100});

if(messages.size<5){

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("confirm_close_transcript")
.setLabel("Fechar com transcript")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("confirm_close_no_transcript")
.setLabel("Fechar sem transcript")
.setStyle(ButtonStyle.Secondary)

);

return interaction.reply({
content:"Este ticket tem poucas mensagens. Precisas de transcript?",
components:[row]
});

}

await interaction.reply("A gerar transcript e fechar...");

await sendTranscript(channel,user.tag);

setTimeout(()=>channel.delete().catch(()=>{}),5000);

}

if(interaction.isButton() && cid==="confirm_close_transcript"){

await interaction.update({
content:"A gerar transcript...",
components:[]
});

await sendTranscript(channel,user.tag);

setTimeout(()=>channel.delete().catch(()=>{}),5000);

}

if(interaction.isButton() && cid==="confirm_close_no_transcript"){

await interaction.update({
content:"Ticket fechado.",
components:[]
});

setTimeout(()=>channel.delete().catch(()=>{}),3000);

}

}catch(err){

console.error("Erro interaction:",err);

}

});

};
