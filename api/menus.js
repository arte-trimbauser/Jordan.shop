// api/menus.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
    process.env.SUPABASE_KEY
);

// Cache interno para não bater sempre no bot
let cache = { menus: null, ts: 0 };
const TTL = 60 * 1000; // 60s

module.exports = async (req, res) => {
    try {
        // ============================================================
        // GET — devolve menus do Supabase diretamente
        // ============================================================
        if (req.method === 'GET') {
            if (cache.menus && Date.now() - cache.ts < TTL) {
                return res.json({ success: true, menus: cache.menus, cached: true });
            }

            const { data, error } = await supabase
                .from('menus')
                .select('*')
                .order('ordem', { ascending: true });

            if (error) throw error;

            cache = { menus: data || [], ts: Date.now() };
            return res.json({ success: true, menus: data || [] });
        }

        // ============================================================
        // POST — grava no Supabase (direto, sem passar pelo bot)
        // ============================================================
        if (req.method === 'POST') {
            const body = req.body || {};

            // Reenviar → tem de ir ao bot (é o bot que tem acesso ao Discord)
            if (body.action === 'reenviar') {
                if (!body.id) {
                    return res.status(400).json({ success: false, error: 'id em falta' });
                }
                const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 25000);

                    const r = await fetch(`${BOT_URL}/api/menus/reenviar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: body.id }),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    const data = await r.json().catch(() => ({ success: false, error: 'resposta inválida' }));
                    return res.status(r.status).json(data);
                } catch (err) {
                    return res.status(504).json({
                        success: false,
                        error: err.name === 'AbortError'
                            ? 'O bot demorou demasiado a responder. Tenta novamente.'
                            : 'Não foi possível contactar o bot: ' + err.message
                    });
                }
            }

            // Guardar menu → direto no Supabase
            const { id } = body;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id em falta' });
            }

            const permitidos = ['title', 'embed_desc', 'embed_image', 'embed_thumbnail', 'color', 'options', 'ordem'];
            const update = {};
            for (const k of permitidos) {
                if (body[k] !== undefined) update[k] = body[k];
            }
            update.atualizado_em = new Date().toISOString();

            const { error } = await supabase
                .from('menus')
                .update(update)
                .eq('id', String(id));

            if (error) throw error;

            // Invalida o cache local
            cache = { menus: null, ts: 0 };

            return res.json({ success: true });
        }

        // Outros métodos
        return res.status(405).json({ success: false, error: 'Método não permitido' });

    } catch (err) {
        console.error('Erro em /api/menus:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
