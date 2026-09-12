// src/helpers/sendTranscript.js
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");

// ============ CONFIG ============
const TRANSCRIPT_CHANNEL_ID = "1424461544317517854";
const SUPABASE_URL = "https://fdbmhgcfhdnnpwuodxzh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY; // service_role
const BUCKET = "transcripts";
const MEDIA_BUCKET = "ticket-media"; // ⚠️ bucket PÚBLICO (ver nota no fim)
const SITE_URL = "https://jordan-shop-bot-site.vercel.app";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sanitizeFileName(name = "") {
    return String(name).replace(/[^\w.\-]/g, "_").slice(0, 120) || "ficheiro";
}

function formatDate(date) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Lisbon",
        dateStyle: "short",
        timeStyle: "medium",
    }).format(new Date(date));
}

// ============================================================
// MEDIA PERSISTENTE (imagens que NÃO expiram)
// ============================================================
const mediaCache = new Map(); // url -> urlPersistente (evita downloads duplicados)

async function fetchBuffer(url, maxBytes = MAX_FILE_SIZE) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return null;
    return buf;
}

async function uploadMedia(path, buf, contentType = "application/octet-stream") {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": contentType,
            "x-upsert": "true",
        },
        body: buf,
    });
    if (!res.ok) {
        console.error("❌ Erro upload media:", path, res.status, await res.text().catch(() => ""));
        return null;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/**
 * Descarrega uma imagem/ficheiro do Discord e guarda no Supabase.
 * Retorna a URL persistente, ou a URL original se falhar (fallback).
 */
async function persistUrl(url, folder, fileName, contentType) {
    if (!url || !SUPABASE_KEY) return url;
    if (mediaCache.has(url)) return mediaCache.get(url);

    try {
        const buf = await fetchBuffer(url);
        if (!buf) { mediaCache.set(url, url); return url; }
        const finalUrl = await uploadMedia(`${folder}/${sanitizeFileName(fileName)}`, buf, contentType || "application/octet-stream");
        const result = finalUrl || url;
        mediaCache.set(url, result);
        return result;
    } catch (err) {
        console.error("⚠️ Falha ao persistir media:", err.message);
        mediaCache.set(url, url);
        return url;
    }
}

// ============================================================
// MENÇÕES — resolução de nomes reais (como no Discord)
// ============================================================
function buildMentionMaps(msg) {
    return {
        users: new Map(msg.mentions?.users?.map((u, id) => [id, u.username]) || []),
        channels: new Map(msg.mentions?.channels?.map((c, id) => [id, c.name]) || []),
        roles: new Map(msg.mentions?.roles?.map((r, id) => [id, r.name]) || []),
    };
}

/** Pré-busca utilizadores mencionados que não estão no cache (max 25 para não travar) */
async function prefetchMentions(sorted, guild, client) {
    const users = new Map(), channels = new Map(), roles = new Map();

    // Roles e canais vêm do guild (sempre disponíveis)
    try {
        for (const [id, r] of guild.roles.cache) roles.set(id, r.name);
    } catch {}
    try {
        for (const [id, c] of guild.channels.cache) channels.set(id, c.name);
    } catch {}

    // Utilizadores: dos caches das mensagens primeiro
    for (const msg of sorted) {
        for (const [id, u] of msg.mentions?.users || []) users.set(id, u.username);
    }

    // Depois faz fetch dos que faltam (conteúdo + embeds)
    const missing = new Set();
    const scan = (text) => {
        if (!text) return;
        const re = /<@!?(\d+)>/g;
        let m;
        while ((m = re.exec(text)) !== null) if (!users.has(m[1])) missing.add(m[1]);
    };
    for (const msg of sorted) {
        scan(msg.content);
        for (const e of msg.embeds || []) {
            scan(e.title); scan(e.description);
            for (const f of e.fields || []) { scan(f.name); scan(f.value); }
            scan(e.footer?.text); scan(e.author?.name);
        }
    }

    let count = 0;
    for (const id of missing) {
        if (count++ >= 25) break; // segurança
        const u = await client.users.fetch(id).catch(() => null);
        if (u) users.set(id, u.username);
    }
    return { users, channels, roles, guildId: guild.id };
}

// ============================================================
// FORMATAÇÃO DISCORD → HTML
// ============================================================
function formatDiscordText(value = "", ctx = null) {
    if (!value) return "";
    let text = escapeHtml(value);

    // ===== 1. Auto-link de URLs PRIMEIRO =====
    text = text.replace(
        /(https?:\/\/[^\s"'<>()]+)/g,
        (u) => `<a class="message-link" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
    );

    // ===== 2. Emojis personalizados → <img> (CDN não expira) =====
    text = text.replace(/&lt;(a?):([\w~]+):(\d+)&gt;/g, (_, animated, name, id) => {
        const ext = animated ? "gif" : "png";
        return `<img class="emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless" alt=":${name}:" title=":${name}:" loading="lazy">`;
    });

    // ===== 3. MENÇÕES — nomes reais como no Discord =====
    text = text.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
        const name = ctx?.users?.get(id);
        return `<span class="mention mention-user" title="ID: ${id}">@${escapeHtml(name || "utilizador")}</span>`;
    });
    text = text.replace(/&lt;#(\d+)&gt;/g, (_, id) => {
        const name = ctx?.channels?.get(id);
        if (name && ctx?.guildId) {
            return `<a class="mention mention-channel" href="https://discord.com/channels/${ctx.guildId}/${id}" target="_blank" rel="noopener noreferrer">#${escapeHtml(name)}</a>`;
        }
        return `<span class="mention mention-channel">#canal</span>`;
    });
    text = text.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
        const name = ctx?.roles?.get(id);
        return `<span class="mention mention-role">@${escapeHtml(name || "cargo")}</span>`;
    });

    // ===== 4. Blocos de código =====
    text = text.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${escapeHtml(c.trim())}</code></pre>`);
    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");

    // ===== 5. Spoilers =====
    text = text.replace(/\|\|([^|]+)\|\|/g, (_, c) => `<span class="spoiler">${formatDiscordText(c, ctx)}</span>`);

    // ===== 6. Headers =====
    text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");

    // ===== 7. Blockquotes =====
    text = text.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");

    // ===== 8. Markdown links [txt](url) =====
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
        `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`
    );

    // ===== 9. Bold / Italic / Underline / Strike =====
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__(.+?)__/g, "<u>$1</u>");
    text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");
    text = text.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1<em>$2</em>");
    text = text.replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1<em>$2</em>");

    return text;
}

function getEmbedColor(embed) {
    if (embed?.color === null || embed?.color === undefined) return "#5865f2";
    const n = Number(embed.color);
    if (!Number.isFinite(n)) return "#5865f2";
    return `#${n.toString(16).padStart(6, "0").slice(-6)}`;
}

function renderImage(url, alt = "Imagem", className = "embed-image") {
    if (!url) return "";
    return `<a class="image-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy"></a>`;
}

async function renderEmbed(embed, ctx, ticketId) {
    if (!embed) return "";

    // Persiste imagens do embed (thumbnails/icones de attachments Discord EXPIRAM)
    if (embed.image?.url) embed.image.url = await persistUrl(embed.image.url, `${ticketId}/embeds`, `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`, "image/png");
    if (embed.thumbnail?.url) embed.thumbnail.url = await persistUrl(embed.thumbnail.url, `${ticketId}/embeds`, `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`, "image/png");
    if (embed.author?.iconURL) embed.author.iconURL = await persistUrl(embed.author.iconURL, `${ticketId}/embeds`, `author-${Date.now()}.png`, "image/png");
    if (embed.footer?.iconURL) embed.footer.iconURL = await persistUrl(embed.footer.iconURL, `${ticketId}/embeds`, `footer-${Date.now()}.png`, "image/png");

    const title = embed.title ? formatDiscordText(embed.title, ctx) : "";
    const description = embed.description ? formatDiscordText(embed.description, ctx) : "";
    const color = getEmbedColor(embed);
    const thumbnail = embed.thumbnail?.url ? renderImage(embed.thumbnail.url, "Thumbnail", "embed-thumbnail") : "";
    const image = embed.image?.url ? renderImage(embed.image.url, "Imagem do embed", "embed-image") : "";
    const author = embed.author?.name
        ? `<div class="embed-author">${embed.author.iconURL ? `<img src="${escapeHtml(embed.author.iconURL)}" alt="">` : ""}<span>${formatDiscordText(embed.author.name, ctx)}</span></div>`
        : "";
    let fields = "";
    if (Array.isArray(embed.fields) && embed.fields.length) {
        fields = `<div class="embed-fields">${embed.fields.map(f =>
            `<div class="embed-field ${f.inline ? "inline" : ""}">
                <div class="embed-field-name">${formatDiscordText(f.name || "", ctx)}</div>
                <div class="embed-field-value">${formatDiscordText(f.value || "", ctx)}</div>
            </div>`).join("")}</div>`;
    }
    const footer = embed.footer?.text
        ? `<div class="embed-footer">${embed.footer.iconURL ? `<img src="${escapeHtml(embed.footer.iconURL)}" alt="">` : ""}<span>${formatDiscordText(embed.footer.text, ctx)}</span>${embed.timestamp ? `<span class="embed-timestamp">• ${escapeHtml(formatDate(embed.timestamp))}</span>` : ""}</div>`
        : "";
    if (!title && !description && !fields && !thumbnail && !image && !author && !footer) return "";
    return `<div class="embed" style="--embed-color:${color}">
        ${author}
        <div class="embed-main">
            <div class="embed-content">
                ${title ? `<div class="embed-title">${title}</div>` : ""}
                ${description ? `<div class="embed-description">${description}</div>` : ""}
                ${fields}
                ${footer}
            </div>
            ${thumbnail ? `<div class="embed-thumb-wrap">${thumbnail}</div>` : ""}
        </div>
        ${image}
    </div>`;
}

// ============================================================
// CSS DO TRANSCRIPT
// ============================================================
const CSS = `
*{box-sizing:border-box}
:root{--bg:#313338;--bg2:#2b2d31;--bg3:#1e1f22;--text:#dbdee1;--muted:#949ba4;--white:#f2f3f5;--link:#00a8fc;--mention:#c9cdfb}
html{background:var(--bg)}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased}
a{color:var(--link)}
img{max-width:100%}

/* ===== TOPBAR ===== */
.topbar{position:sticky;top:0;z-index:10;background:rgba(30,31,34,.96);backdrop-filter:blur(12px);border-bottom:1px solid #111214;padding:14px 24px}
.server{display:flex;align-items:center;gap:14px;max-width:1100px;margin:auto}
.server-icon{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#5865f2;flex:0 0 44px;border:1px solid rgba(255,255,255,.08)}
.server-info{min-width:0;flex:1}
.server-name{color:var(--white);font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px}
.server-name .tag{background:#5865f2;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.4px}
.channel-name{color:var(--muted);font-size:13px;margin-top:1px}
.channel-topic{color:#6d7179;font-size:11px;margin-top:2px;font-family:'Consolas','Courier New',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ===== CONTAINER ===== */
.wrap{max-width:1100px;margin:0 auto;padding:28px 24px 60px}

/* ===== TICKET HEADER ===== */
.ticket-header{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:22px 24px;margin-bottom:24px}
.ticket-header h1{margin:0 0 12px;color:var(--white);font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px}
.ticket-header h1 .dot{width:10px;height:10px;border-radius:50%;background:#23a55a;box-shadow:0 0 0 2px rgba(35,165,90,.25)}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px 18px}
.meta-item{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12.5px}
.meta-item .lbl{color:#6d7179}
.meta-item .val{color:var(--white);font-weight:500}

/* ===== MENSAGENS ===== */
.messages{padding-top:6px}
.message{display:flex;gap:16px;padding:10px 8px 10px 0;border-radius:6px;transition:background .1s}
.message:hover{background:rgba(255,255,255,.025)}
.avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;flex:0 0 42px;background:#202225}
.message-content{min-width:0;flex:1}
.author-line{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px}
.author{color:var(--white);font-weight:600}
.bot-tag{background:#5865f2;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-left:2px}
.time{color:var(--muted);font-size:12px}
.edited{color:var(--muted);font-size:10px}
.body{margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text)}
.body.empty{color:var(--muted);font-style:italic}

/* ===== MENÇÕES (estilo Discord) ===== */
.mention{color:var(--mention);background:rgba(88,101,242,.30);border-radius:3px;padding:0 2px;font-weight:500;cursor:pointer;transition:background .12s,color .12s;text-decoration:none}
.mention:hover{background:#5865f2;color:#fff}
.mention-channel{color:#a4b0f7}
.mention-role{color:#e6b26e;background:rgba(226,178,110,.18)}

/* ===== INLINE ELEMENTS ===== */
.emoji{width:1.375em;height:1.375em;vertical-align:-.35em;object-fit:contain;display:inline-block}
.message-link{text-decoration:none;overflow-wrap:anywhere;word-break:break-word}
.message-link:hover{text-decoration:underline}
code{background:#1e1f22;border:1px solid rgba(255,255,255,.06);border-radius:4px;padding:1px 4px;color:#c9cdfb;font-family:'Consolas','Courier New',monospace;font-size:.9em}
blockquote{margin:6px 0 6px 8px;padding-left:12px;border-left:4px solid #5865f2;color:#b5bac1}
.spoiler{background:#2b2d31;color:transparent;border-radius:3px;padding:0 2px;cursor:pointer;transition:color .2s,background .2s}
.spoiler:hover{color:inherit;background:transparent}
h1,h2,h3{margin:8px 0 4px;color:var(--white);font-weight:700}
pre{background:#1e1f22;border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:8px 12px;overflow-x:auto;margin:6px 0}
pre code{background:transparent;border:none;padding:0;font-size:13px;color:#dbdee1}

/* ===== EMBEDS (estilo Discord) ===== */
.embed{max-width:680px;margin-top:8px;padding:12px 14px 14px;border-left:4px solid var(--embed-color,#5865f2);background:#2b2d31;border-radius:4px;position:relative}
.embed-main{display:flex;gap:12px}
.embed-content{flex:1;min-width:0}
.embed-title{color:var(--white);font-weight:700;margin-bottom:5px;font-size:15px}
.embed-description{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;color:#dbdee1}
.embed-author{color:var(--white);font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px}
.embed-author img,.embed-footer img{width:20px;height:20px;border-radius:50%;object-fit:cover}
.embed-thumbnail{width:80px;height:80px;object-fit:cover;border-radius:4px;flex:0 0 80px}
.embed-image{display:block;max-width:min(100%,560px);max-height:500px;object-fit:contain;border-radius:4px;margin-top:10px;background:#202225;cursor:zoom-in;transition:filter .12s}
.embed-image:hover{filter:brightness(1.12)}
.image-link{display:inline-block;line-height:0}
.embed-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px}
.embed-field:not(.inline){grid-column:1/-1}
.embed-field-name{color:var(--white);font-weight:700;font-size:13px;margin-bottom:2px}
.embed-field-value{margin-top:2px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}
.embed-footer{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;margin-top:10px}
.embed-timestamp{color:#6d7179}

/* ===== REPLY ===== */
.reply-ref{font-size:12px;color:#949ba4;margin-top:3px;display:flex;align-items:center;gap:5px}
.reply-ref a{color:#c9cdfb;text-decoration:none}
.reply-ref a:hover{text-decoration:underline}

/* ===== ANEXOS ===== */
.attachment{margin-top:8px;background:#1e1f22;border:1px solid rgba(255,255,255,.05);border-radius:6px;padding:8px 10px;width:fit-content;max-width:100%}
.attachment a{text-decoration:none;overflow-wrap:anywhere}
.attachment-image{display:block;max-width:min(100%,560px);max-height:500px;border-radius:4px;margin-top:7px;object-fit:contain;cursor:zoom-in;transition:filter .12s}
.attachment-image:hover{filter:brightness(1.12)}

/* ===== DIVISOR DE DIA ===== */
.system-divider{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px;margin:22px 0;font-weight:500}
.system-divider::before,.system-divider::after{content:"";height:1px;background:rgba(255,255,255,.06);flex:1}

/* ===== FOOTER ===== */
.footer{text-align:center;color:var(--muted);font-size:12px;padding:32px 16px 8px;border-top:1px solid rgba(255,255,255,.05);margin-top:32px}
.footer a{color:#8b8f96;text-decoration:none}
.footer a:hover{color:var(--link)}

/* ===== LIGHTBOX (clicar nas imagens) ===== */
#lightbox{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(4px)}
#lightbox.open{display:flex;animation:lbIn .15s ease}
#lightbox img{max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 12px 60px rgba(0,0,0,.6);cursor:default}
@keyframes lbIn{from{opacity:0}to{opacity:1}}

@media (max-width:700px){
    .topbar{padding:12px 14px}
    .wrap{padding:18px 12px 40px}
    .ticket-header{padding:16px}
    .ticket-header h1{font-size:17px}
    .message{gap:10px}
    .avatar{width:36px;height:36px;flex-basis:36px}
    .embed-main{flex-direction:column}
    .embed-thumbnail{width:64px;height:64px;flex-basis:64px}
}
`;

const LIGHTBOX_JS = `
document.addEventListener('click', function(e){
    var link = e.target.closest ? e.target.closest('a.image-link') : null;
    if (!link) return;
    e.preventDefault();
    var lb = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-img');
    img.src = link.getAttribute('href');
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
});
document.getElementById('lightbox').addEventListener('click', function(e){
    if (e.target === this || e.target.id === 'lightbox-img') {
        this.classList.remove('open');
        document.body.style.overflow = '';
    }
});
document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
        var lb = document.getElementById('lightbox');
        lb.classList.remove('open');
        document.body.style.overflow = '';
    }
});
`;

// ============================================================
// GERAR HTML DO TRANSCRIPT
// ============================================================
async function gerarHtml(channel, sorted, allMessages, ticketId) {
    const guildName = channel.guild?.name || "Servidor Discord";
    const guildIcon = await persistUrl(
        channel.guild?.iconURL?.({ extension: "png", size: 128 }) || "",
        `${ticketId}/server`,
        "icon.png",
        "image/png"
    );
    const channelName = channel.name || `ticket-${ticketId}`;
    const topic = channel.topic || "";
    const createdAt = sorted[0]?.createdAt ? formatDate(sorted[0].createdAt) : "—";
    const generatedAt = formatDate(new Date());

    // Resolução de menções (nomes reais)
    const mentionCtx = await prefetchMentions(sorted, channel.guild, channel.client);

    // Extrai "aberto por / método / produto" do tópico "userId|método|produto"
    const [topicUserId, topicMetodo, topicProduto] = topic.split("|");
    let abertoPor = "—";
    if (/^\d{17,19}$/.test(topicUserId || "")) {
        const u = await channel.client.users.fetch(topicUserId).catch(() => null);
        if (u) abertoPor = u.username;
    }
    const metodoFormatado = topicMetodo ? topicMetodo.replace(/_/g, " ") : "—";
    const produtoFormatado = topicProduto ? topicProduto.replace(/_/g, " ") : "—";

    let html = `<!DOCTYPE html>
<html lang="pt-PT"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#8b0000">
<title>Transcript — #${escapeHtml(channelName)}</title>
<style>${CSS}</style>
</head><body>

<div class="topbar">
  <div class="server">
    ${guildIcon ? `<img class="server-icon" src="${escapeHtml(guildIcon)}" alt="">` : `<div class="server-icon"></div>`}
    <div class="server-info">
      <div class="server-name">${escapeHtml(guildName)} <span class="tag">Transcript</span></div>
      <div class="channel-name">#${escapeHtml(channelName)}</div>
      ${topic ? `<div class="channel-topic">${escapeHtml(topic)}</div>` : ""}
    </div>
  </div>
</div>

<main class="wrap">
  <section class="ticket-header">
    <h1><span class="dot"></span>Transcript — #${escapeHtml(channelName)}</h1>
    <div class="meta">
      <div class="meta-item"><span class="lbl">🎫 Ticket:</span> <span class="val">${escapeHtml(ticketId)}</span></div>
      <div class="meta-item"><span class="lbl">👤 Aberto por:</span> <span class="val">${escapeHtml(abertoPor)}</span></div>
      <div class="meta-item"><span class="lbl">💳 Método:</span> <span class="val">${escapeHtml(metodoFormatado)}</span></div>
      <div class="meta-item"><span class="lbl">📦 Produto:</span> <span class="val">${escapeHtml(produtoFormatado)}</span></div>
      <div class="meta-item"><span class="lbl">💬 Mensagens:</span> <span class="val">${sorted.length}</span></div>
      <div class="meta-item"><span class="lbl">🕐 Início:</span> <span class="val">${escapeHtml(createdAt)}</span></div>
    </div>
  </section>

  <section class="messages">`;

    let lastDay = "";
    for (const msg of sorted) {
        const day = new Intl.DateTimeFormat("pt-PT", {
            timeZone: "Europe/Lisbon",
            dateStyle: "full",
        }).format(new Date(msg.createdTimestamp));
        if (day !== lastDay) {
            html += `<div class="system-divider">${escapeHtml(day)}</div>`;
            lastDay = day;
        }

        // ===== Avatar PERSISTENTE (não expira) =====
        const avatarDiscord = msg.author?.displayAvatarURL?.({ extension: "png", size: 128 }) || "";
        const avatar = avatarDiscord
            ? await persistUrl(avatarDiscord, `${ticketId}/avatars`, `${msg.author.id}.png`, "image/png")
            : "";

        const author =
            msg.member?.displayName ||
            msg.author?.globalName ||
            msg.author?.username ||
            "Utilizador desconhecido";
        const botTag = msg.author?.bot ? `<span class="bot-tag">BOT</span>` : "";
        const time = formatDate(msg.createdAt);
        const msgCtx = buildMentionMaps(msg);
        // Mescla com o contexto global (garante nomes mesmo se o cache da msg falhar)
        for (const [id, name] of mentionCtx.users) if (!msgCtx.users.has(id)) msgCtx.users.set(id, name);
        msgCtx.channels = mentionCtx.channels;
        msgCtx.roles = mentionCtx.roles;
        msgCtx.guildId = mentionCtx.guildId;

        const content = msg.content ? formatDiscordText(msg.content, msgCtx) : "";
        const edited = msg.editedTimestamp ? `<span class="edited">(editada)</span>` : "";

        html += `<article class="message" id="m-${escapeHtml(msg.id)}">
${avatar ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy">` : `<div class="avatar"></div>`}
<div class="message-content">
  <div class="author-line">
    <span class="author">${escapeHtml(author)}</span>${botTag}
    <span class="time">${escapeHtml(time)}</span>${edited}
  </div>
  <div class="body ${content ? "" : "empty"}">${content || "Sem texto"}</div>`;

        // Reply reference
        if (msg.reference?.messageId) {
            const ref = allMessages.get(msg.reference.messageId);
            const ra =
                ref?.member?.displayName ||
                ref?.author?.globalName ||
                ref?.author?.username ||
                "mensagem";
            html += `<div class="reply-ref">↪ Resposta a <a href="#m-${escapeHtml(msg.reference.messageId)}">${escapeHtml(ra)}</a></div>`;
        }

        // Embeds (imagens persistidas dentro de renderEmbed)
        for (const embed of msg.embeds || []) html += await renderEmbed(embed, msgCtx, ticketId);

        // Attachments — imagens e ficheiros PERSISTENTES
        for (const att of msg.attachments.values()) {
            const safeName = sanitizeFileName(att.name || `anexo-${att.id}`);
            const isImg = (att.contentType || "").startsWith("image/");
            const finalUrl = await persistUrl(att.url, `${ticketId}/anexos`, `${msg.id}-${safeName}`, att.contentType || "application/octet-stream");
            const sizeMB = att.size ? (att.size / 1024 / 1024).toFixed(2) : null;
            html += `<div class="attachment"><a href="${escapeHtml(finalUrl)}" target="_blank" rel="noopener noreferrer">📎 ${escapeHtml(att.name || "Anexo")}${sizeMB ? ` <span style="color:#6d7179">(${sizeMB} MB)</span>` : ""}</a>${isImg ? renderImage(finalUrl, att.name, "attachment-image") : ""}</div>`;
        }

        // Stickers
        for (const st of msg.stickers.values()) {
            const stUrl = st.url || st.stickerURL?.() || "";
            const finalSticker = stUrl ? await persistUrl(stUrl, `${ticketId}/stickers`, `${st.id}.png`, "image/png") : "";
            html += `<div class="attachment">🎨 Sticker: <strong>${escapeHtml(st.name || "Sticker")}</strong>${finalSticker ? ` ${renderImage(finalSticker, st.name, "attachment-image")}` : ""}</div>`;
        }

        html += `</div></article>`;
    }

    html += `</section>
  <div class="footer">
    Fim do transcript • ${sorted.length} mensagens exportadas • Gerado em ${escapeHtml(generatedAt)}<br>
    <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a>
  </div>
</main>

<div id="lightbox"><img id="lightbox-img" alt=""></div>
<script>${LIGHTBOX_JS}</script>
</body></html>`;

    return { html, channelName };
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
module.exports = async function sendTranscript(channel, fechadoPor) {
    try {
        if (!channel) throw new Error("Canal não fornecido");

        // 1. Buscar TODAS as mensagens
        const allMessages = new Map();
        let lastId = null;
        while (true) {
            const opts = { limit: 100 };
            if (lastId) opts.before = lastId;
            const batch = await channel.messages.fetch(opts);
            if (!batch?.size) break;
            for (const m of batch.values()) allMessages.set(m.id, m);
            if (batch.size < 100) break;
            lastId = batch.last().id;
        }

        const sorted = Array.from(allMessages.values()).sort(
            (a, b) => a.createdTimestamp - b.createdTimestamp
        );

        // 2. Gerar HTML (com media persistente + menções reais)
        mediaCache.clear(); // novo ticket = novo cache
        const ticketId = channel.id;
        const { html, channelName } = await gerarHtml(channel, sorted, allMessages, ticketId);

        // 3. Upload para Supabase Storage
        let verLink = "";

        if (!SUPABASE_KEY) {
            console.error("❌ SUPABASE_KEY não definida — upload ignorado.");
        } else {
            try {
                const fileName = `${channelName}.html`;
                const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`;

                const uploadRes = await fetch(uploadUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                        "Content-Type": "text/html; charset=utf-8",
                        "x-upsert": "true",
                    },
                    body: html,
                });

                if (uploadRes.ok) {
                    verLink = `${SITE_URL}/transcripts/${channelName}`;
                    console.log(`✅ Transcript guardado no Supabase: ${verLink}`);
                } else {
                    const err = await uploadRes.text();
                    console.error("❌ Erro upload Supabase:", uploadRes.status, err);
                }
            } catch (err) {
                console.error("❌ Erro ao enviar para Supabase:", err.message);
            }
        }

        // 4. Enviar para o canal dos transcripts
        const logChannel = await channel.client.channels
            .fetch(TRANSCRIPT_CHANNEL_ID)
            .catch(() => null);

        if (!logChannel) {
            console.error(`❌ Canal de transcripts ${TRANSCRIPT_CHANNEL_ID} não encontrado`);
            return null;
        }

        const attachment = new AttachmentBuilder(Buffer.from(html, "utf-8"), {
            name: `transcript-${channelName}.html`,
        });

        const sent = await logChannel.send({
            content: "📄 A gerar transcript...",
            files: [attachment],
        });

        const fallbackUrl = sent.attachments.first()?.url || "";
        const linkFinal = verLink || fallbackUrl || "https://discord.com";

        // Extrai quem abriu o ticket
        let abertoPor = "Desconhecido";
        try {
            const openerId = (channel.topic || "").split("|")[0];
            if (/^\d{17,19}$/.test(openerId)) {
                const u = await channel.client.users.fetch(openerId).catch(() => null);
                if (u) abertoPor = u.username;
            }
        } catch {}

        // 5. Embed final
        const embedFinal = new EmbedBuilder()
            .setTitle("📄 Transcrição Arquivada")
            .setDescription(`🔗 **Ver Online:** [Clique Aqui](${linkFinal})`)
            .addFields(
                { name: "Canal", value: `\`${channelName}\``, inline: false },
                { name: "Aberto por", value: `\`${abertoPor}\``, inline: false },
                { name: "Fechado por", value: `\`${fechadoPor || "Desconhecido"}\``, inline: false }
            )
            .setColor("#8b0000")
            .setFooter({ text: "Jordan Shop | Transcript" })
            .setTimestamp();

        await sent.edit({ content: null, embeds: [embedFinal] });

        console.log(`✅ Transcript enviado para #${logChannel.name} (ticket ${channelName})`);
        return sent;
    } catch (err) {
        console.error("❌ Erro ao gerar/enviar transcript:", err);
        return null;
    }
};
