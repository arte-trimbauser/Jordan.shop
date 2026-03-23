require('dotenv').config();

module.exports = {
  // IDs dos Cargos (Lê do Render ou usa o número fixo se o Render falhar)
  STAFF_ROLES: [
    process.env.OWNER_ROLE_ID || "1393658593131233421",
    process.env.DEVELOPER_ROLE_ID || "1447241549489639661",
    process.env.SUPPORT_ROLE_ID || "1421595512477450373",
    "1393658417884823662", // Moderador
    "1393658313006383176"  // Staff
  ],

  // Teus IDs de Developer (para ignorar cooldown)
  DEV_IDS: ["996454465555136675", "924344854232834068"],

  // AQUI ESTÁ O SEGREDO: Se não houver CATEGORY_ID no Render, ele avisa
  CATEGORY_ID: process.env.CATEGORY_ID, 

  CATEGORY_NAME: "Tickets",
  TRANSCRIPT_LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "1437076921627181228" STAFF_LOGS_CHANNEL_ID: "1437076921627181228" // Adiciona esta linha
};
