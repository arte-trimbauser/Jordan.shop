// api/recuperar-password.js
const crypto = require('crypto');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto-para-algo-longo';
const WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_RECUPERACAO ||
    'https://discord.com/api/webhooks/1491444823251751083/Cdbu_D0JbeXbMXikLvm15Ij052NZsJL0FLoMTdpMcM6AiMzT_-pVWSkA91uFcp5DhL2x';

const credenciais = {
    "Jordan Costa": "Jordan26Costa",
    "Arteex26": "Arteex_26",
    "lucasvieira0453": "lucasvieira",
    "migueldodrip_09110": "migueldodrip",
    "pincher11": "pincher11"
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username em falta' });

    const chave = Object.keys(credenciais).find(
        k => k.toLowerCase() === String(username).toLowerCase()
    );
    if (!chave) return res.status(404).json({ error: 'Utilizador não encontrado' });

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = Date.now() + 5 * 60 * 1000;

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const token = Buffer.from(`${expira}:${assinatura}`).toString('base64');

    try {
        const r = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content:
                    '🔐 **Recuperação de Password — Jordan Shop**\n\n' +
                    `**Utilizador:** \`${chave}\`\n` +
                    `**Código:** \`${codigo}\`\n\n` +
                    '⏰ Válido durante **5 minutos**.'
            })
        });
        if (!r.ok) {
            console.error('Erro webhook:', await r.text());
            return res.status(500).json({ error: 'Erro ao enviar o código para o Discord' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro de rede' });
    }

    return res.json({ success: true, token });
};
