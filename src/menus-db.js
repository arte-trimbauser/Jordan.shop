// BOT: src/menus-db.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let cache = { data: null, ts: 0 };
const TTL = 60 * 1000; // 1 min

async function getMenus() {
    if (cache.data && Date.now() - cache.ts < TTL) return cache.data;

    const { data, error } = await supabase
        .from('menus')
        .select('*')
        .order('ordem', { ascending: true });

    if (error || !data || !data.length) {
        console.warn('⚠️ Supabase falhou, a usar fallback menu.js');
        // Fallback para menu.js local
        delete require.cache[require.resolve('./menus.js')];
        return require('./menus.js');
    }

    // Reconverter para o formato original (camelCase)
    const menus = data.map(m => ({
        id: m.id,
        title: m.title,
        embedDesc: m.embed_desc,
        embedImage: m.embed_image || '',
        embedThumbnail: m.embed_thumbnail || '',
        color: m.color || undefined,
        options: m.options || [],
        // ticketMessage fica hardcoded (mantém o mesmo em todos)
        ticketMessage: () => 'obrigado(a) por criar um ticket, em breve algum staff te ajudara'
    }));

    cache = { data: menus, ts: Date.now() };
    return menus;
}

function limparCacheMenus() { cache = { data: null, ts: 0 }; }

module.exports = { getMenus, limparCacheMenus };
