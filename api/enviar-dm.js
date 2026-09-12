// api/enviar-dm.js
const express = require('express');
const router = express.Router();
const { EmbedBuilder } = require('discord.js');

router.post('/', async (req, res) => {
    try {
        const { userId, titulo, descricao, cor, campos } = req.body || {};
        if (!userId) return res.status(400).json({ success: false, error: 'userId em falta' });

        if (!global.client || !global.client.isReady || !global.client.isReady()) {
            return res.status(503).json({ success: false, error: 'Bot não está pronto' });
        }

        const user = await global.client.users.fetch(userId).catch(() => null);
        if (!user) return res.status(404).json({ success: false, error: 'Utilizador não encontrado' });

        const embed = new EmbedBuilder()
            .setTitle(titulo || 'Jordan Shop')
            .setDescription(descricao || '')
            .setColor(cor || '#8b0000')
            .setTimestamp()
            .setFooter({ text: 'Jordan Shop System' });

        if (Array.isArray(campos)) embed.addFields(campos);

        await user.send({ embeds: [embed] });
        res.json({ success: true });
    } catch (err) {
        console.error('Erro em /api/enviar-dm:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
