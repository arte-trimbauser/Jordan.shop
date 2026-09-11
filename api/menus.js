// BOT: api/migrar-menus.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
    // Proteção por secret — muda isto!
    const SECRET = process.env.MIGRAR_SECRET || 'migrar-123-muda-isto';
    if (req.query.secret !== SECRET) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
        // Importa o teu menu.js atual
        delete require.cache[require.resolve('../src/menus.js')];
        const menus = require('../src/menus.js');

        const registos = menus.map((m, i) => ({
            id: String(m.id),
            title: m.title || '',
            embed_desc: m.embedDesc || '',
            embed_image: m.embedImage || '',
            embed_thumbnail: m.embedThumbnail || '',
            color: m.color || null,
            options: m.options || [],
            ordem: i
        }));

        // Upsert (não duplica se já existir)
        const { error } = await supabase.from('menus').upsert(registos, { onConflict: 'id' });
        if (error) throw error;

        res.json({ success: true, inseridos: registos.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
};
