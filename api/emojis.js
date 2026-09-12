// api/emojis.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        if (!global.client || !global.client.isReady || !global.client.isReady()) {
            return res.status(503).json({ success: false, error: 'Bot ainda não está pronto' });
        }

        const GUILD_ID = process.env.GUILD_ID || '1393629457599828040';
        const guild = await global.client.guilds.fetch(GUILD_ID);
        const emojis = await guild.emojis.fetch();

        const lista = emojis.map(e => ({
            id: e.id,
            name: e.name,
            animated: e.animated,
            url: e.imageURL({ size: 48, extension: e.animated ? 'gif' : 'png' }),
            tag: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`
        }));

        res.json({ success: true, emojis: lista });
    } catch (err) {
        console.error('Erro em /api/emojis:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
