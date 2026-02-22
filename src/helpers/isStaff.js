const { PermissionsBitField } = require("discord.js");
const { STAFF_ROLES } = require("../config");

module.exports = function isStaff(member) {
  if (!member) return false;
  return member.roles?.cache?.some(r => STAFF_ROLES.includes(r.id)) || member.permissions?.has?.(PermissionsBitField.Flags.Administrator);
};
