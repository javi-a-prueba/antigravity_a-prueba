'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
const PORT    = 3000;
const API_KEY = 'AIzaSyCQUIiCH7WjmZm5gHpWNwPA01LbtgAUPwU';
const ai      = new GoogleGenAI({ apiKey: API_KEY });

const MIME_TYPES = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.pdf':  'application/pdf',
    '.ico':  'image/x-icon',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Lee el body de una petición POST y lo parsea como JSON */
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try   { resolve(JSON.parse(data || '{}')); }
            catch (e) { reject(new Error('Body JSON inválido')); }
        });
        req.on('error', reject);
    });
}

/** Envía una respuesta JSON */
function sendJSON(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

/** Extrae el texto de la respuesta de Gemini (compatible con @google/genai v2.x) */
function extractGeminiText(response) {
    if (typeof response.text === 'function') return response.text();
    if (typeof response.text === 'string')   return response.text;
    const part = response?.candidates?.[0]?.content?.parts?.[0];
    return part?.text ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTA: POST /api/socraticTutor
// ─────────────────────────────────────────────────────────────────────────────
async function handleSocraticTutor(req, res) {
    let body;
    try { body = await readBody(req); }
    catch { return sendJSON(res, 400, { error: 'Body JSON inválido' }); }

    const {
        mensaje, historial = [],
        enunciado = '', resolucion_latex = '', pista = '',
        curso = 'ESO/Bachillerato', asignatura = 'Ciencias',
        respuestaAlumno = '',
    } = body;

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
        return sendJSON(res, 400, { error: 'El campo "mensaje" es obligatorio.' });
    }

    const systemPrompt = `Eres ARIA, el Tutor Socrático de A-PRUEBA, una plataforma de estudio para estudiantes españoles de ${curso} en las asignaturas de Física, Matemáticas y Química.

REGLAS ABSOLUTAS — NUNCA las rompas:
1. JAMÁS des la respuesta final o la solución completa al alumno.
2. Haz SOLO UNA pregunta o da UNA pista por mensaje. Nada más.
3. Si el alumno te pide directamente la respuesta, responde con empatía pero redirige con una pregunta guía.
4. Usa lenguaje cercano, positivo y motivador. El alumno tiene entre 12 y 18 años.
5. Responde siempre en español.
6. Cuando uses fórmulas, usa notación LaTeX entre $...$ (inline) o $$...$$ (bloque).

MÉTODO SOCRÁTICO — Estructura de respuesta:
[Validación breve] → [Explicación o pista conceptual de 1-2 frases] → [Una sola pregunta guía]

CONTEXTO DEL EJERCICIO (NO lo reveles al alumno):
- Asignatura: ${asignatura}
- Nivel: ${curso}
- Enunciado: ${enunciado || 'No hay ejercicio activo.'}
- Solución oficial (NUNCA la reveles): ${resolucion_latex || 'Desconocida'}
- Pista disponible: ${pista || 'Sin pista adicional.'}
${respuestaAlumno ? `- Respuesta actual del alumno: "${respuestaAlumno}"` : ''}`;

    // Reconstruir historial (últimos 12 mensajes)
    const contents = historial.slice(-12).map(m => ({
        role:  m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.parts?.[0]?.text ?? m.content ?? '' }],
    }));

    // Añadir mensaje actual si no está ya al final
    const last = contents[contents.length - 1];
    if (!last || last.role !== 'user' || last.parts[0].text !== mensaje.trim()) {
        contents.push({ role: 'user', parts: [{ text: mensaje.trim() }] });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents,
            config: { systemInstruction: systemPrompt, temperature: 0.75, maxOutputTokens: 512 },
        });

        const reply = extractGeminiText(response);
        if (!reply) throw new Error('Gemini devolvió respuesta vacía.');

        return sendJSON(res, 200, { reply });

    } catch (err) {
        console.error('[/api/socraticTutor] Error Gemini:', err.message);
        return sendJSON(res, 500, { error: `Error del tutor IA: ${err.message}` });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTA: POST /api/getAdaptedExercise
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetAdaptedExercise(req, res) {
    let body;
    try { body = await readBody(req); }
    catch { return sendJSON(res, 400, { error: 'Body JSON inválido' }); }

    const {
        enunciado, resolucion_latex,
        pista = '', formula = '',
        asignatura = 'Ciencias', curso = '',
        comunidadAutonoma,
    } = body;

    if (!enunciado || !resolucion_latex || !comunidadAutonoma) {
        return sendJSON(res, 400, {
            error: 'Se requieren: enunciado, resolucion_latex y comunidadAutonoma.',
        });
    }

    const systemPrompt = `Eres un experto en educación secundaria y bachillerato español, especializado en los currículums y estilos de examen de cada Comunidad Autónoma (CCAA).

Tu tarea es adaptar un ejercicio de ${asignatura}${curso ? ` de ${curso}` : ''} al estilo de examen de la Comunidad Autónoma de ${comunidadAutonoma}.

REGLAS ESTRICTAS que debes seguir:
1. Adapta el ENUNCIADO al registro lingüístico, nomenclatura y estructura típica de los exámenes de selectividad o evaluación de esa CCAA (por ejemplo, preguntas más directas, apartados a y b, etc).
2. Puedes cambiar sutilmente los datos numéricos para que suenen más "naturales" al estilo regional, pero si lo haces, RECALCULA toda la resolución de forma matemáticamente exacta.
3. Recalcula también de forma matemáticamente exacta la PISTA para que coincida con el nuevo enunciado adaptado.
4. ¡MUY IMPORTANTE!: Mantén SIEMPRE el formato LaTeX utilizando el símbolo $ para fórmulas inline y $$ para fórmulas en bloque, sin romper el código.
5. No cambies el concepto evaluado, la asignatura ni el nivel de dificultad.
6. El ejercicio adaptado debe ser completamente autocontenido.
7. Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de markdown, sin texto extra antes o después:
{"enunciado_adaptado":"...","resolucion_latex_adaptada":"...", "pista_adaptada":"..."}`;

    const userMessage = `Adapta este ejercicio para la Comunidad Autónoma de ${comunidadAutonoma}:

ENUNCIADO ORIGINAL:
${enunciado}

RESOLUCIÓN ORIGINAL (LaTeX):
${resolucion_latex}
${formula ? `\nFÓRMULA CLAVE: ${formula}` : ''}
${pista   ? `\nPISTA ASOCIADA: ${pista}`   : ''}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: {
                systemInstruction: systemPrompt,
                temperature:       0.4,   // Menor temperatura = más fiel y preciso en los cálculos
                maxOutputTokens:   1024,
            },
        });

        let rawText = extractGeminiText(response).trim();
        if (!rawText) throw new Error('Gemini devolvió respuesta vacía.');

        // Limpiar posibles bloques de código markdown que Gemini añade a veces
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

        // Parsear el JSON de respuesta
        let adapted;
        try {
            adapted = JSON.parse(rawText);
        } catch {
            // Si Gemini añadió texto extra, intentar extraer solo el JSON
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                adapted = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('La respuesta de Gemini no contiene JSON válido.');
            }
        }

        if (!adapted.enunciado_adaptado || !adapted.resolucion_latex_adaptada) {
            throw new Error('El JSON de respuesta no tiene los campos esperados.');
        }

        return sendJSON(res, 200, {
            enunciado_adaptado:       adapted.enunciado_adaptado,
            resolucion_latex_adaptada: adapted.resolucion_latex_adaptada,
            pista_adaptada:           adapted.pista_adaptada || pista,
            comunidadAutonoma,
        });

    } catch (err) {
        console.error('[/api/adaptExercise] Error:', err.message);
        // Fallback: devolvemos el ejercicio original sin adaptar
        return sendJSON(res, 200, {
            enunciado_adaptado:       enunciado,
            resolucion_latex_adaptada: resolucion_latex,
            pista_adaptada:           pista,
            comunidadAutonoma,
            fallback: true,
            error:    err.message,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVIDOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    // Cabeceras CORS para todas las rutas
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ── Rutas API (POST) ────────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/socraticTutor') {
        return handleSocraticTutor(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/getAdaptedExercise') {
        return handleGetAdaptedExercise(req, res);
    }

    // ── Servidor de archivos estáticos (GET) ────────────────────────
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = filePath.split('?')[0];  // Limpiar query params

    const absPath    = path.join(__dirname, filePath);
    const extname    = path.extname(absPath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

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
    console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════');
    console.log('\x1b[32m%s\x1b[0m', ' 🚀  Servidor A-PRUEBA iniciado correctamente');
    console.log('\x1b[33m%s\x1b[0m', ` 👉  http://localhost:${PORT}`);
    console.log('\x1b[35m%s\x1b[0m', ' 🤖  API Gemini: /api/socraticTutor');
    console.log('\x1b[35m%s\x1b[0m', ' 🗺️   API Gemini: /api/getAdaptedExercise');
    console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════');
    console.log(' Presiona Ctrl+C para detener.\n');
});
