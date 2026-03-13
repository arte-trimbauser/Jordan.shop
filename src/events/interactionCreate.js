const { 
EmbedBuilder, 
ActionRowBuilder, 
ButtonBuilder, 
ButtonStyle, 
PermissionsBitField, 
StringSelectMenuBuilder, 
MessageFlags 
} = require("discord.js");

const config = require("../config");
const discordTranscripts = require("discord-html-transcripts");
const fs = require("fs");
const path = require("path");
const isStaff = require("../helpers/isStaff");

function sendLog(guild, text){
    guild.channels.fetch(config.LOG_CHANNEL_ID)
    .then(logChannel => {
        if(logChannel) logChannel.send(text);
    })
    .catch(()=>null);
}

module.exports = (client) => {

    client.on("interactionCreate", async (interaction) => {

        if (!interaction) return;

        try {

if(!guild) return;
/* MENU TICKET */

if(interaction.isStringSelectMenu() && cid === "menu_ticket"){

const tipo = interaction.values[0];

const embed = new EmbedBuilder()
.setTitle("📜 Termos de Serviço")
.setDescription(`
🔁 **Reembolsos:** Não existem.

🔄 **Substituição:** Apenas voucher.

👤 **Contas:** Alterar dados após entrega.

💸 **PayPal:** Amigos e Familiares.

🌐 **Suporte:** Português
`)
.setColor("#ff0000");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`aceitar_termos_${tipo}`)
.setLabel("Aceitar")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("recusar_termos")
.setLabel("Recusar")
.setStyle(ButtonStyle.Danger)
);

return interaction.reply({
embeds:[embed],
components:[row],
flags:[MessageFlags.Ephemeral]
});
}

/* RECUSAR TERMOS */

if(interaction.isButton() && cid === "recusar_termos"){

await sendLog(guild, `❌ ${user} **não aceitou os termos.**`);

return interaction.reply({
content:"❌ Tens de aceitar os termos para abrir um ticket.",
flags:[MessageFlags.Ephemeral]
});

}

/* ACEITAR TERMOS */

if(interaction.isButton() && cid.startsWith("aceitar_termos_")){

const tipo = cid.replace("aceitar_termos_","");

await sendLog(guild, `✅ ${user} **aceitou os termos.**`);

const embed = new EmbedBuilder()
.setTitle("💳 Escolha o método de pagamento")
.setColor("#00ff99");

const row = new ActionRowBuilder().addComponents(
new StringSelectMenuBuilder()
.setCustomId(`pagamento_${tipo}`)
.setPlaceholder("Método de pagamento")
.addOptions([
{label:"MBWay",value:"MBWay",emoji:"1464608251516813446"},
{label:"PayPal",value:"PayPal",emoji:"1464608396383883314"},
{label:"Revolut",value:"Revolut",emoji:"1464608485617565726"},
{label:"Cartão de Crédito",value:"CartaoCredito",emoji:"1464608966826004676"},
{label:"Google Pay",value:"GooglePay",emoji:"1464609044315508797"},
{label:"Apple Pay",value:"ApplePay",emoji:"1464609102906003588"},
{label:"Ref. Multibanco",value:"ReferenciaMultibanco",emoji:"1464609317926735902"}
])
);

return interaction.update({
embeds:[embed],
components:[row]
});

}

/* CRIAR TICKET */

if(interaction.isStringSelectMenu() && cid.startsWith("pagamento_")){

const tipo = cid.replace("pagamento_","");
const metodo = interaction.values[0];

await interaction.update({
content:"⏳ A abrir ticket...",
embeds:[],
components:[]
});

let category = guild.channels.cache.find(
c => c.name === config.CATEGORY_NAME && c.type === 4
);

if(!category){
category = await guild.channels.create({
name:config.CATEGORY_NAME,
type:4
});
}

const ticket = await guild.channels.create({
name:`ticket-${user.username}`,

parent:category.id,

topic:`${user.id}|${metodo}`,

permissionOverwrites:[

{
id:guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},

{
id:user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
},

...config.STAFF_ROLES.map(r=>({
id:r,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}))

]

});

/* EMBED DO TICKET */

const embedTicket = new EmbedBuilder()
.setTitle("obrigado(a) por criar um ticket, em breve algum staff te ajudará")
.setDescription(`
💳 **Método escolhido:** ${metodo}

Quando um staff reivindicar o ticket aparecerá aqui.
`)
.setColor("#2f3136");

/* BOTÕES */

const rowTicket = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("Reivindicar")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Fechar")
.setStyle(ButtonStyle.Danger)

);

/* ENVIAR NO TICKET */

await ticket.send({
content:`<@${user.id}>`,
embeds:[embedTicket],
components:[rowTicket]
});

/* MENSAGEM NO CANAL ORIGINAL */

const redirectRow = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setLabel("Ir para o Ticket")
.setStyle(ButtonStyle.Link)
.setURL(`https://discord.com/channels/${guild.id}/${ticket.id}`)

);

await interaction.followUp({
content:`✅ Ticket criado: ${ticket}`,
components:[redirectRow]
});

}

/* CLAIM STAFF */

if(interaction.isButton() && cid === "claim_ticket"){

if(!isStaff(member))
return interaction.reply({
content:"❌ Apenas staff.",
flags:[MessageFlags.Ephemeral]
});

const info = channel.topic.split("|");
const metodo = info[1];

const embedClaim = new EmbedBuilder()
.setTitle("🛡️ Ticket Reivindicado")
.setDescription(`
👤 **Staff:** ${user}

💳 **Método:** ${metodo}
`)
.setColor("#57f287");

return interaction.update({

embeds:[embedClaim],

components:[
new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("Reivindicado")
.setStyle(ButtonStyle.Success)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Fechar")
.setStyle(ButtonStyle.Danger)

)
]

});

}

/* FECHAR */

if(interaction.isButton() && cid === "close_ticket"){

await interaction.reply({
content:"📁 A fechar ticket...",
flags:[MessageFlags.Ephemeral]
});

setTimeout(()=>{
channel.delete().catch(()=>{});
},3000);

}

        } catch (err) {
            console.error(err);
        }

    });

};
