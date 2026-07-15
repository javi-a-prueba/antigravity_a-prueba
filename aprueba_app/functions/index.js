const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenAI } = require('@google/genai');

const apiKey = "AIzaSyCQUIiCH7WjmZm5gHpWNwPA01LbtgAUPwU";

exports.socraticTutor = onCall({}, async (request) => {
    // Verificación de seguridad: solo usuarios autenticados
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'El tutor socrático solo está disponible para usuarios autenticados.');
    }

    const { enunciado, resolucion_latex, pista, mensaje, historial, curso, asignatura, respuestaAlumno } = request.data;

    // Validación mínima
    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim() === '') {
        throw new HttpsError('invalid-argument', 'El campo "mensaje" es obligatorio.');
    }

    // Inicializar Gemini de forma segura
    if (!apiKey) {
        console.error("La API Key no está configurada.");
        throw new HttpsError('internal', 'La clave de API del tutor no está configurada.');
    }

    const ai = new GoogleGenAI({ apiKey });

    // ── System Prompt Socrático ───────────────────────────────────────
    const systemPrompt = `Eres ARIA, el Tutor Socrático de A-PRUEBA, una plataforma de estudio para estudiantes españoles de ${curso || "ESO y Bachillerato"} en las asignaturas de Física, Matemáticas y Química.

REGLAS ABSOLUTAS — NUNCA las rompas:
1. JAMÁS des la respuesta final o la solución completa al alumno.
2. Haz SOLO UNA pregunta o da UNA pista por mensaje. Nada más.
3. Si el alumno te pide directamente la respuesta, responde con empatía pero redirige con una pregunta guía.
4. Usa lenguaje cercano, positivo y motivador. El alumno tiene entre 12 y 18 años.
5. Si el alumno escribe en español, responde siempre en español.
6. Cuando uses fórmulas o expresiones matemáticas, usa notación LaTeX entre $...$ (inline) o $$...$$ (bloque).

MÉTODO SOCRÁTICO — Estructura de respuesta:
[Validación breve del esfuerzo del alumno] → [Explicación o pista conceptual de 1-2 frases] → [Una sola pregunta guía que le haga pensar el siguiente paso]

CONTEXTO DEL EJERCICIO ACTUAL (no lo reveles al alumno):
- Asignatura: ${asignatura || "Desconocida"}
- Nivel: ${curso || "Desconocido"}
- Enunciado: ${enunciado || "No hay ejercicio activo en este momento."}
- Solución oficial (NUNCA la reveles): ${resolucion_latex || "Desconocida"}
- Pista disponible: ${pista || "Sin pista adicional."}
${respuestaAlumno ? `- Respuesta actual del alumno en su cuaderno: "${respuestaAlumno}"` : ""}

Recuerda: tu misión es que el alumno llegue a la solución por sus propios razonamientos, sintiendo que él mismo lo ha descubierto.`;

    // ── Reconstruir historial ─────────────────────────────────────────
    // Limitamos a los últimos 12 mensajes (6 turnos) para controlar costes
    let recentHistory = (historial || []).slice(-12).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts && msg.parts[0] ? msg.parts[0].text : (msg.content || "") }]
    }));

    // Asegurarnos de que el mensaje actual del usuario está al final
    const lastMsg = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null;
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.parts[0].text !== mensaje.trim()) {
        recentHistory.push({ role: "user", parts: [{ text: mensaje.trim() }] });
    }

    // ── Llamada a Gemini ──────────────────────────────────────────────
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: recentHistory,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.75,
                maxOutputTokens: 512
            }
        });

        // Extraer texto de respuesta de forma robusta (compatible con @google/genai v2.x)
        let responseText = "";
        if (typeof response.text === 'function') {
            responseText = response.text();
        } else if (typeof response.text === 'string') {
            responseText = response.text;
        } else if (response.candidates && response.candidates[0]) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                responseText = candidate.content.parts[0].text || "";
            }
        }

        if (!responseText) {
            console.error("Gemini devolvió una respuesta vacía. Raw response:", JSON.stringify(response));
            throw new HttpsError('internal', 'El tutor recibió una respuesta vacía del modelo de IA.');
        }

        return { reply: responseText };

    } catch (error) {
        // Si es un HttpsError lo relanzamos directamente
        if (error instanceof HttpsError) throw error;

        console.error("Error al llamar a Gemini API:", error.message || error);

        // Dar mensajes de error específicos según el tipo
        if (error.message && error.message.includes('API_KEY')) {
            throw new HttpsError('permission-denied', 'La API Key de Gemini no es válida. Configura el secret GEMINI_API_KEY en Firebase.');
        }
        if (error.message && error.message.includes('quota')) {
            throw new HttpsError('resource-exhausted', 'Límite de uso de la IA alcanzado. Inténtalo en unos minutos.');
        }

        throw new HttpsError('internal', `Error al procesar la respuesta del tutor: ${error.message}`);
    }
});
