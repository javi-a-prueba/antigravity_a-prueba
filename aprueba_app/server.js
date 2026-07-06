const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Tipos MIME básicos para que el navegador interprete correctamente los archivos
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Si la ruta es /, servimos index.html
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Limpiamos los parámetros de búsqueda de la URL (ej: ?tema=campo-grav)
    filePath = filePath.split('?')[0];

    const absPath = path.join(__dirname, filePath);
    const extname = String(path.extname(absPath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // Manejo de CORS explícito (por si acaso el frontend hiciera peticiones extrañas al propio server)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    fs.readFile(absPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`Archivo no encontrado: ${filePath}`);
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Error del servidor: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('\x1b[36m%s\x1b[0m', '=========================================');
    console.log('\x1b[32m%s\x1b[0m', `🚀 Servidor local A-PRUEBA iniciado!`);
    console.log('\x1b[33m%s\x1b[0m', `👉 Abre en tu navegador: http://localhost:${PORT}`);
    console.log('\x1b[36m%s\x1b[0m', '=========================================');
    console.log('Presiona Ctrl+C para detener el servidor.\n');
});
