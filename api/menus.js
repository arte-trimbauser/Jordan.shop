// BOT: api/menus.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('categoria')
            .order('ordem');
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, menus: data });
    }

    if (req.method === 'POST') {
        const { id, preco, descricao, nome, emoji } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id em falta' });

        const { error } = await supabase.from('menus')
            .update({ preco, descricao, nome, emoji, atualizado_em: new Date().toISOString() })
            .eq('id', id);
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true });
    }

    res.status(405).json({ success: false, error: 'Método não permitido' });
};
