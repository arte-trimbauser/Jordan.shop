const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuração do caminho da pasta de transcripts
// Nota: Como o teu log mostrou 'src/transcripts', usamos este caminho
const transcriptsDir = path.join(__dirname, 'src', 'transcripts');

// Garantir que a pasta existe ao iniciar
if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

// Servir os ficheiros estáticos do site (HTML, CSS, JS do teu painel)
app.use(express.static(__dirname));

// ROTA 1: Listar os ficheiros (para o teu painel mostrar a lista)
app.get('/api/transcripts', (req, res) => {
    fs.readdir(transcriptsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: "Erro ao ler a pasta de transcripts" });
        }
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        res.json(htmlFiles);
    });
});

// ROTA 2: Abrir o ficheiro (para quando clicares no nome do ficheiro)
app.get('/transcripts/:filename', (req, res) => {
    const filePath = path.join(transcriptsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("Ficheiro não encontrado.");
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor a correr em http://localhost:${PORT}`);
    console.log(`📂 Pasta de transcripts: ${transcriptsDir}`);
});
