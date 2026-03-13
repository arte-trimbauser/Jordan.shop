const config = require("../config");

module.exports = function isStaff(member) {
    if (!member || !member.roles || !member.roles.cache) return false;
    return config.STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
};
