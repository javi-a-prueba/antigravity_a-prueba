const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenAI } = require('@google/genai');

const geminiApiKey = defineSecret('GEMINI_API_KEY');

exports.socraticTutor = onCall({ secrets: [geminiApiKey] }, async (request) => {
    // Verificación de seguridad: solo usuarios autenticados
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'El tutor socrático solo está disponible para usuarios autenticados.');
    }

    const { enunciado, resolucion_latex, pista, mensaje, historial } = request.data;

    // Inicializar Gemini de forma segura
    const fallbackKey = "AQ.Ab8RN6LFwYGukIzyH0d8l4BQqmgiaaX8n3xdrHp5OHufvIUxIg";
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() || fallbackKey });

    const systemPrompt = `Eres un Tutor Socrático experto. NUNCA des la respuesta final directa. Guía al alumno paso a paso. Haz solo UNA pregunta o da UNA pista por mensaje. Si el alumno se equivoca, hazle dudar para que descubra su error. Refuerza positivamente. Tu estructura debe ser: [Validación] -> [Explicación breve] -> [Pregunta guía].

Contexto Oculto (NO LE DES LA SOLUCIÓN AL ALUMNO):
El alumno está resolviendo: ${enunciado || "Desconocido"}
La solución a la que debe llegar es: ${resolucion_latex || "Desconocida"}
Usa esta pista si se atasca: ${pista || "Desconocida"}`;

    // Reconstruir el historial limitándolo a los últimos 10 mensajes (por costo y relevancia)
    let recentHistory = (historial || []).slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts && msg.parts[0] ? msg.parts[0].text : (msg.content || "") }]
    }));

    // Si el último mensaje en el historial ya es el mensaje del usuario (porque el frontend lo añadió),
    // no lo duplicamos. Si no está, lo añadimos.
    const lastMessage = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null;
    if (!lastMessage || lastMessage.role !== 'user' || lastMessage.parts[0].text !== mensaje) {
        recentHistory.push({ role: "user", parts: [{ text: mensaje }] });
    }

    const contents = [...recentHistory];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: contents,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7
            }
        });
        const responseText = response.text; // En el nuevo SDK genai es response.text (getter)
        return { reply: responseText };
    } catch (error) {
        console.error("Error Gemini:", error);
        throw new HttpsError('internal', 'Error al procesar la respuesta del tutor.');
    }
});
