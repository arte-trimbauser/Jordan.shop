// api/verificar-codigo.js
const crypto = require('crypto');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto-para-algo-longo';

const credenciais = {
    "Jordan Costa": "Jordan26Costa",
    "Arteex26": "Arteex_26",
    "lucasvieira0453": "lucasvieira",
    "migueldodrip_09110": "migueldodrip",
    "pincher11": "pincher11"
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { username, codigo, token } = req.body || {};
    if (!username || !codigo || !token) return res.status(400).json({ error: 'Dados em falta' });

    const chave = Object.keys(credenciais).find(
        k => k.toLowerCase() === String(username).toLowerCase()
    );
    if (!chave) return res.status(404).json({ error: 'Utilizador não encontrado' });

    let expira, assinaturaEsperada;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        [expira, assinaturaEsperada] = decoded.split(':');
        expira = parseInt(expira, 10);
    } catch {
        return res.status(400).json({ error: 'Token inválido' });
    }

    if (!expira || !assinaturaEsperada) return res.status(400).json({ error: 'Token inválido' });
    if (Date.now() > expira) return res.status(400).json({ error: 'O código expirou. Pede um novo.' });

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    const a = Buffer.from(assinatura, 'hex');
    const b = Buffer.from(assinaturaEsperada, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(400).json({ error: 'Código inválido' });
    }

    return res.json({ success: true, password: credenciais[chave] });
};
