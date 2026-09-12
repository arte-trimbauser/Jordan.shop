// api/menus.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { limparCacheMenus } = require('../src/menus-db');

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('ordem', { ascending: true });
        if (error) throw error;
        res.json({ success: true, menus: data || [] });
    } catch (err) {
        console.error('Erro em GET /api/menus:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id em falta' });

        const permitidos = ['title', 'embed_desc', 'embed_image', 'embed_thumbnail', 'color', 'options', 'ordem'];
        const update = {};
        for (const k of permitidos) {
            if (req.body[k] !== undefined) update[k] = req.body[k];
        }
        update.atualizado_em = new Date().toISOString();

        const { error } = await supabase.from('menus').update(update).eq('id', String(id));
        if (error) throw error;

        limparCacheMenus(); // força o bot a recarregar do Supabase
        res.json({ success: true });
    } catch (err) {
        console.error('Erro em POST /api/menus:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
