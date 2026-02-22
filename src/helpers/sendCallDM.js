const { EmbedBuilder } = require("discord.js");

module.exports = async function sendCallDM({ toUserId, fromUser, channel, isStaffCall }) {
  try {
    const user = await channel.client.users.fetch(toUserId).catch(() => null);
    if (!user) return;

    const embed = new EmbedBuilder()
      .setColor(isStaffCall ? "#00ff00" : "#ff9900")
      .setTitle(isStaffCall ? "📞 Staff chamou-te" : "📞 Cliente chamou a staff")
      .setDescription(
        isStaffCall
          ? `O staff **${fromUser.tag}** chamou-te no ticket:\n🔗 ${channel.url}`
          : `O cliente **${fromUser.tag}** chamou-te no ticket:\n🔗 ${channel.url}`
      )
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => console.log(`⚠️ Não foi possível enviar DM para ${user.tag}.`));
  } catch (err) {
    console.error("Erro ao enviar DM:", err);
  }
};
