const CLIENTE_WAIT = 5*60*1000;
const STAFF_WAIT = 2*60*1000;

module.exports = {
  clienteCooldown: new Map(),
  staffCooldown: new Map(),
  CLIENTE_WAIT,
  STAFF_WAIT
};
