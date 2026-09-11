// BOT: api/menus.js
const { createClient } = require('@supabase/supabase-js');
const { limparCacheMenus } = require('../src/menus-db');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('ordem', { ascending: true });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, menus: data });
    }

    if (req.method === 'POST') {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id em falta' });

        // Permite atualizar qualquer campo editável
        const permitidos = ['title', 'embed_desc', 'embed_image', 'embed_thumbnail', 'color', 'options'];
        const update = {};
        for (const k of permitidos) {
            if (req.body[k] !== undefined) update[k] = req.body[k];
        }
        update.atualizado_em = new Date().toISOString();

        const { error } = await supabase.from('menus').update(update).eq('id', String(id));
        if (error) return res.status(500).json({ success: false, error: error.message });

        limparCacheMenus(); // força o bot a recarregar
        return res.json({ success: true });
    }

    res.status(405).json({ success: false, error: 'Método não permitido' });
};
