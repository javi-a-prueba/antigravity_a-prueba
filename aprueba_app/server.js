'use strict';
require('dotenv').config(); // Carga variables de entorno desde .env

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
const PORT    = 3000;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: GEMINI_API_KEY no está definida en el archivo .env');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Credenciales de Firestore REST (misma API Key del proyecto Firebase del frontend)
const FIREBASE_API_KEY  = 'AIzaSyDwBaUwQQ1uy2vyjPocjGttzrStAjUoNrM';
const FIRESTORE_PROJECT = 'aprueba-e7242';
const FIRESTORE_BASE    = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

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
// HELPERS FIRESTORE REST API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Realiza una petición HTTPS a la API REST de Firestore.
 * @param {string} method   - 'GET' | 'PATCH'
 * @param {string} urlPath  - Ruta relativa tras FIRESTORE_BASE (con query params si aplica)
 * @param {object|null} body - Payload JSON para PATCH
 * @returns {Promise<object>} - JSON de respuesta parseado
 */
function firestoreRequest(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
        const fullUrl = `${FIRESTORE_BASE}${urlPath}?key=${FIREBASE_API_KEY}`;
        const url     = new URL(fullUrl);
        const payload = body ? JSON.stringify(body) : null;

        const options = {
            hostname: url.hostname,
            path:     url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

/**
 * Convierte un objeto JS plano en un Firestore "fields" object para PATCH.
 * Solo soporta strings (suficiente para nuestro caso de uso).
 */
function toFirestoreFields(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
        else if (typeof v === 'number')  fields[k] = { integerValue: String(v) };
    }
    return fields;
}

/**
 * Convierte los "fields" de Firestore REST al formato JS plano.
 */
function fromFirestoreFields(fields = {}) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) {
        if (v.stringValue  !== undefined) obj[k] = v.stringValue;
        else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
        else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
        else if (v.doubleValue  !== undefined) obj[k] = v.doubleValue;
    }
    return obj;
}

/**
 * Lee un documento de Firestore.
 * @returns {object|null} - Los datos del documento, o null si no existe.
 */
async function firestoreGet(docPath) {
    try {
        const { status, body } = await firestoreRequest('GET', `/${docPath}`);
        if (status === 200 && body.fields) {
            return fromFirestoreFields(body.fields);
        }
        return null; // 404 u otro error → no existe
    } catch {
        return null;
    }
}

/**
 * Escribe (crea o sobreescribe) un documento en Firestore vía PATCH.
 * @param {string} docPath  - Ruta del documento (ej: "ejercicios/abc123/adaptaciones/Madrid")
 * @param {object} data     - Objeto JS con los campos a guardar
 */
async function firestoreSet(docPath, data) {
    const fields = toFirestoreFields(data);
    // Construimos el updateMask para PATCH con los nombres de los campos
    const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    // firestoreRequest añade la key automáticamente — solo pasamos ruta + mask
    const urlWithMask = `/${docPath}?${mask}`;
    try {
        await firestoreRequest('PATCH', urlWithMask, { fields });
    } catch (e) {
        console.warn('[Firestore] Error al escribir caché:', e.message);
    }
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
        comunidad = 'Desconocida',
        curso = 'ESO/Bachillerato', asignatura = 'Ciencias',
        ejercicioActual = {},
        respuestaAlumno = '',
    } = body;

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
        return sendJSON(res, 400, { error: 'El campo "mensaje" es obligatorio.' });
    }

    const systemPrompt = `Eres ARIA, un Tutor Socrático experto. El alumno es de la Comunidad Autónoma de ${comunidad} y estudia ${asignatura} de ${curso}.

Actualmente está intentando resolver este ejercicio:
ENUNCIADO: ${ejercicioActual.enunciado || 'No hay ejercicio activo.'}
SOLUCIÓN REAL (NO SE LA DIGAS, ÚSALA SOLO PARA GUIARLE): ${ejercicioActual.resolucion_latex || 'Desconocida'}
PISTA DISPONIBLE: ${ejercicioActual.pista || 'Sin pista adicional.'}

REGLAS ABSOLUTAS — NUNCA las rompas:
1. REGLA DE ORO: No le des la respuesta final o la solución completa al alumno. Hazle preguntas para que él mismo llegue a la solución paso a paso.
2. Haz SOLO UNA pregunta o da UNA pista por mensaje. Nada más.
3. Si el alumno te pide directamente la respuesta, responde con empatía pero redirige con una pregunta guía.
4. Usa lenguaje cercano, positivo y motivador. El alumno tiene entre 12 y 18 años.
5. Responde siempre en español.
6. Cuando uses fórmulas, usa notación LaTeX entre $...$ (inline) o $$...$$ (bloque).

MÉTODO SOCRÁTICO — Estructura de respuesta:
[Validación breve] → [Explicación o pista conceptual de 1-2 frases] → [Una sola pregunta guía]

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
            model: 'gemini-1.5-flash',
            contents,
            config: { systemInstruction: systemPrompt, temperature: 0.75, maxOutputTokens: 8192 },
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
// RUTA: POST /api/getAdaptedExercise  (con caché inteligente en Firestore)
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetAdaptedExercise(req, res) {
    let body;
    try { body = await readBody(req); }
    catch { return sendJSON(res, 400, { error: 'Body JSON inválido' }); }

    const {
        exerciseId,                    // ID del documento en /ejercicios_base/{exerciseId}
        originalExercise = {},         // Objeto con enunciado, resolucion_latex, pista, formula…
        // Compatibilidad con la forma antigua (campos directos en el body)
        enunciado:        enunciadoDir,
        resolucion_latex: resolucionDir,
        pista:            pistaDir,
        formula:          formulaDir,
        asignatura:       asignaturaDir,
        curso:            cursoDir,
        comunidadAutonoma,
    } = body;

    // Normalizar: aceptar tanto { exerciseId, originalExercise, comunidadAutonoma }
    // como la forma anterior { enunciado, resolucion_latex, ..., comunidadAutonoma }
    const enunciado        = originalExercise.enunciado        || enunciadoDir  || '';
    const resolucion_latex = originalExercise.resolucion_latex || resolucionDir || '';
    const pista            = originalExercise.pista            || pistaDir      || '';
    const formula          = originalExercise.formula          || formulaDir    || '';
    const asignatura       = originalExercise.asignatura       || asignaturaDir || 'Ciencias';
    const curso            = originalExercise.curso            || cursoDir      || '';

    if (!enunciado || !resolucion_latex || !comunidadAutonoma) {
        return sendJSON(res, 400, {
            error: 'Se requieren: enunciado (o originalExercise.enunciado), resolucion_latex y comunidadAutonoma.',
        });
    }

    // ── PASO 1: Comprobar caché en Firestore ──────────────────────────────────
    // Ruta: /ejercicios_base/{exerciseId}/adaptaciones/{comunidadAutonoma}
    if (exerciseId) {
        const cacheDocPath = `ejercicios_base/${exerciseId}/adaptaciones/${comunidadAutonoma}`;
        const cached = await firestoreGet(cacheDocPath);

        if (cached && cached.enunciado_adaptado && cached.resolucion_latex_adaptada) {
            console.log(`[AdaptCA] 💾 CACHÉ HIT — ejercicio "${exerciseId}" para "${comunidadAutonoma}" (sin coste IA)`);
            return sendJSON(res, 200, {
                ...cached,
                comunidadAutonoma,
                fromCache: true,
            });
        }
        console.log(`[AdaptCA] 🤖 CACHÉ MISS — generando adaptación para "${exerciseId}" + "${comunidadAutonoma}"...`);
    }

    // ── PASO 2: Llamar a Gemini (modo JSON nativo) ───────────────────────────
    const systemPrompt = `Eres un experto en educación secundaria y bachillerato español, especializado en los currículums y estilos de examen de cada Comunidad Autónoma (CCAA).

Tu tarea es adaptar un ejercicio de ${asignatura}${curso ? ` de ${curso}` : ''} al estilo de examen de la Comunidad Autónoma de ${comunidadAutonoma}.

REGLAS ESTRICTAS que debes seguir:
1. Adapta el ENUNCIADO al registro lingüístico, nomenclatura y estructura típica de los exámenes de selectividad o evaluación de esa CCAA (por ejemplo, preguntas más directas, apartados a y b, etc).
2. Puedes cambiar sutilmente los datos numéricos para que suenen más "naturales" al estilo regional, pero si lo haces, RECALCULA toda la resolución de forma matemáticamente exacta.
3. Recalcula también de forma matemáticamente exacta la PISTA para que coincida con el nuevo enunciado adaptado.
4. FORMATO LaTeX — MUY IMPORTANTE: Usa siempre $ para fórmulas inline y $$ para fórmulas en bloque. NO tienes que doblar las barras invertidas, escríbelo normal como texto plano.
5. No cambies el concepto evaluado, la asignatura ni el nivel de dificultad.
6. El ejercicio adaptado debe ser completamente autocontenido.
7. FORMATO DE SALIDA — CRÍTICO: Devuelve la respuesta en texto plano estructurada ESTRICTAMENTE con estos delimitadores exactos (sin bloques markdown ni json):
===INICIO_ENUNCIADO===
(Aquí va el enunciado adaptado con su LaTeX normal sin escapar barras)
===FIN_ENUNCIADO===
===INICIO_PISTA===
(Aquí va la pista adaptada)
===FIN_PISTA===
===INICIO_RESOLUCION===
(Aquí va la resolución larga en LaTeX)
===FIN_RESOLUCION===

REGLA DE ORO: NO uses formato Markdown en los delimitadores. Escribe estrictamente ===INICIO_ENUNCIADO=== sin negritas, sin cursivas y sin ningún texto antes ni después de los delimitadores. Solo los delimitadores y el contenido.`;

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
                temperature:       0.4,
                maxOutputTokens:   8192,
            },
        });

        let rawText = extractGeminiText(response).trim();
        if (!rawText) throw new Error('Gemini devolvió respuesta vacía.');

        function extractBlock(text, tagName) {
            const startStr = `===INICIO_${tagName}===`;
            const endStr = `===FIN_${tagName}===`;
            if (!text.includes(startStr) || !text.includes(endStr)) return null;
            return text.split(startStr)[1].split(endStr)[0].trim();
        }

        const enunciado_adaptado = extractBlock(rawText, 'ENUNCIADO');
        const pista_adaptada = extractBlock(rawText, 'PISTA');
        const resolucion_latex_adaptada = extractBlock(rawText, 'RESOLUCION');

        // ── FALLBACK ANTI-SATURACIÓN ──────────────────────────────────────────
        if (!enunciado_adaptado || !resolucion_latex_adaptada) {
            console.log("\n[DEBUG] TEXTO CRUDO DEVUELTO POR GEMINI:\n", rawText, "\n");
            console.log(`[API Saturada] Devolviendo ejercicio original temporalmente para evitar error en frontend.`);
            
            return sendJSON(res, 200, {
                enunciado_adaptado:        enunciado,
                resolucion_latex_adaptada: resolucion_latex,
                pista_adaptada:            pista,
                comunidadAutonoma,
                fallback: true,
                fromCache: false,
                error:    'Delimitadores no encontrados. Posible saturación.',
            });
        }

        const resultPayload = {
            enunciado_adaptado,
            resolucion_latex_adaptada,
            pista_adaptada: pista_adaptada || pista,
            comunidadAutonoma,
        };

        // ── PASO 3: Guardar en Firestore (fuego y olvida) ─────────────────────
        if (exerciseId) {
            const cacheDocPath = `ejercicios_base/${exerciseId}/adaptaciones/${comunidadAutonoma}`;
            firestoreSet(cacheDocPath, {
                ...resultPayload,
                generado_en: new Date().toISOString(),
            }).then(() => {
                console.log(`[AdaptCA] 💾 Guardado en caché: ${cacheDocPath}`);
            }).catch(e => {
                console.warn(`[AdaptCA] ⚠️  No se pudo guardar el caché:`, e.message);
            });
        }

        return sendJSON(res, 200, { ...resultPayload, fromCache: false });

    } catch (err) {
        console.error('[/api/getAdaptedExercise] Error Gemini:', err.message);
        // Fallback: devolvemos el ejercicio original sin adaptar
        return sendJSON(res, 200, {
            enunciado_adaptado:        enunciado,
            resolucion_latex_adaptada: resolucion_latex,
            pista_adaptada:            pista,
            comunidadAutonoma,
            fallback: true,
            fromCache: false,
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
    console.log('\x1b[35m%s\x1b[0m', ' 🗺️   API Gemini: /api/getAdaptedExercise (+ caché Firestore)');
    console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════');
    console.log(' Presiona Ctrl+C para detener.\n');
});
