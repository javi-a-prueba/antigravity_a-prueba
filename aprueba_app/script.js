/**
 * ══════════════════════════════════════════════════════════════════
 * script.js — Tutor Socrático + Adaptación por CA
 * ══════════════════════════════════════════════════════════════════
 * Cargado como <script type="module"> desde estudio.html.
 * Usa fetch() al servidor local en lugar de Firebase httpsCallable,
 * eliminando la dependencia de Cloud Functions.
 */

// ── Historial de conversación del tutor ───────────────────────────
let chatHistory = [];

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN DEL CHAT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendBtn   = document.getElementById('chatSendBtn');

    if (!chatInput || !sendBtn) {
        console.warn('[TutorIA] Elementos del chat no encontrados en el DOM.');
        return;
    }

    sendBtn.onclick = (e) => { e.preventDefault(); sendMessage(); };
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        addMessageToChat('user', text);
        chatInput.value = '';
        chatInput.focus();
        showTypingIndicator();
        callSocraticTutor(text);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE UI DEL CHAT
// ─────────────────────────────────────────────────────────────────────────────
function addMessageToChat(role, text) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${role === 'user' ? 'user' : 'ai'}`;
    msgDiv.innerHTML = text.replace(/\n/g, '<br>');
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([msgDiv]).catch(e => console.error('[MathJax]', e));
    }
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages || document.getElementById('typingIndicator')) return;
    const div = document.createElement('div');
    div.className = 'msg ai typing-indicator';
    div.id = 'typingIndicator';
    div.innerHTML = "<span class='dot'></span><span class='dot'></span><span class='dot'></span>";
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR SOCRÁTICO — llama a /api/socraticTutor en el servidor local
// ─────────────────────────────────────────────────────────────────────────────
async function callSocraticTutor(userText) {
    chatHistory.push({ role: 'user', parts: [{ text: userText }] });

    try {
        const ejercicioActual = (window.misionesActivas && window.misionesActivas[window.misionActualIndex])
            ?? null;

        const textarea        = document.getElementById('studentAnswerTextarea');
        const respuestaAlumno = textarea?.value.trim() ?? '';

        const payload = {
            curso:           localStorage.getItem('userCourse') || localStorage.getItem('curso') || 'Desconocido',
            asignatura:      ejercicioActual?.asignatura || localStorage.getItem('seleccion_asignatura') || 'General',
            bloque:          ejercicioActual?.bloque          || 'General',
            enunciado:       ejercicioActual?.enunciado       || 'No hay un ejercicio activo. El alumno tiene una pregunta general.',
            pista:           ejercicioActual?.pista           || 'Sin pista específica.',
            resolucion_latex: ejercicioActual?.resolucion_latex || 'Sin resolución oficial.',
            respuestaAlumno,
            mensaje:         userText,
            historial:       chatHistory.slice(-12),
        };

        const res = await fetch('/api/socraticTutor', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        removeTypingIndicator();

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `Error HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.reply) {
            addMessageToChat('ai', data.reply);
            chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
        } else {
            throw new Error('El servidor no devolvió una respuesta válida.');
        }

    } catch (error) {
        removeTypingIndicator();
        console.error('[TutorIA] Error:', error.message);
        addMessageToChat('ai', `Lo siento, hubo un error al conectar con el tutor: ${error.message}`);
        chatHistory.pop();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTACIÓN POR COMUNIDAD AUTÓNOMA — llama a /api/adaptExercise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapta un ejercicio al estilo de examen de una Comunidad Autónoma.
 * Si la llamada falla, devuelve el ejercicio original sin modificar.
 *
 * @param {Object} ejercicio          - Objeto de ejercicio de Firestore
 * @param {string} comunidadAutonoma  - Nombre de la CA (ej: "Andalucía", "Madrid")
 * @returns {Object} ejercicio con campos enunciado/resolucion_latex potencialmente adaptados
 */
async function adaptarEjercicio(ejercicio, comunidadAutonoma) {
    if (!comunidadAutonoma || !ejercicio?.enunciado || !ejercicio?.resolucion_latex) {
        return ejercicio; // Sin datos suficientes → devolver tal cual
    }

    try {
        const res = await fetch('/api/getAdaptedExercise', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                enunciado:        ejercicio.enunciado,
                resolucion_latex: ejercicio.resolucion_latex,
                pista:            ejercicio.pista    || '',
                formula:          ejercicio.formula  || '',
                asignatura:       ejercicio.asignatura || '',
                curso:            localStorage.getItem('userCourse') || '',
                comunidadAutonoma,
            }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (data.fallback) {
            // El servidor devolvió el ejercicio original (falló Gemini internamente)
            console.warn('[AdaptCA] Gemini falló, usando ejercicio original:', data.error);
            return ejercicio;
        }

        // Devolvemos el ejercicio enriquecido con los campos adaptados
        return {
            ...ejercicio,
            enunciado:               data.enunciado_adaptado,
            resolucion_latex:        data.resolucion_latex_adaptada,
            pista:                   data.pista_adaptada,
            // Guardamos el original por si se necesita mostrar comparación
            enunciado_original:      ejercicio.enunciado,
            resolucion_latex_original: ejercicio.resolucion_latex,
            pista_original:          ejercicio.pista,
            adaptado_para_ca:        comunidadAutonoma,
        };

    } catch (err) {
        console.warn('[AdaptCA] Error de red, usando ejercicio original:', err.message);
        return ejercicio; // Fallback silencioso
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA — accesible desde estudio.html y preguntas.js
// ─────────────────────────────────────────────────────────────────────────────

/** Llamado desde preguntas.js cuando el alumno falla una pregunta */
window.triggerSocraticTutor = function (pregunta, opcionIncorrecta) {
    const msg = `He fallado esta pregunta: "${pregunta}". Mi respuesta incorrecta fue: "${opcionIncorrecta}". Necesito entender por qué me equivoqué, sin que me des la respuesta directa.`;
    addMessageToChat('user', `❌ He fallado: "${pregunta}"\nElegí: "${opcionIncorrecta}". ¿Por qué está mal?`);
    showTypingIndicator();
    callSocraticTutor(msg);
};

/** Adapta un array de ejercicios en paralelo para una CA dada */
window.adaptarEjerciciosParaCA = async function (ejercicios, comunidadAutonoma) {
    if (!comunidadAutonoma || !ejercicios?.length) return ejercicios;
    console.log(`[AdaptCA] Adaptando ${ejercicios.length} ejercicios para "${comunidadAutonoma}"...`);
    const adaptados = await Promise.all(
        ejercicios.map(ej => adaptarEjercicio(ej, comunidadAutonoma))
    );
    console.log('[AdaptCA] Adaptación completada.');
    return adaptados;
};

/** Descarga PDF de misión (placeholder) */
window.downloadMissionPDF = function () {
    alert("Iniciando descarga: 'Misión_Física_Campo_Magnético.pdf'...");
};

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN DE APUNTES
// ─────────────────────────────────────────────────────────────────────────────
function actualizarBotonApuntes(tituloDelTema, asignaturaActual) {
    const asignaturaLimpia = (asignaturaActual || '').toLowerCase().trim();
    const btn         = document.getElementById('btn-descargar-apuntes');
    const msgNoApuntes = document.getElementById('msg-no-apuntes');
    if (!btn) return;

    const urlParams   = new URLSearchParams(window.location.search);
    const idUrl       = urlParams.get('tema');
    let idSeleccion   = null;
    try {
        const rawTemas = localStorage.getItem('seleccion_temas');
        if (rawTemas) {
            const temas = JSON.parse(rawTemas);
            if (Array.isArray(temas) && temas.length > 0) idSeleccion = temas[0].id || temas[0].titulo;
        }
    } catch (e) { /* ignorar */ }

    const idLocal = localStorage.getItem('tema_actual');

    let numeroTema = null;
    let match = (tituloDelTema || '').match(/\d+/);
    if (match) {
        numeroTema = match[0];
    } else {
        const fallbackId = idUrl || idSeleccion || idLocal || '';
        const fireMatch  = fallbackId.match(/_fire_(\d+)/);
        if (fireMatch) {
            numeroTema = (parseInt(fireMatch[1], 10) + 1).toString();
        } else {
            match = fallbackId.match(/\d+/);
            if (match) numeroTema = match[0];
        }
    }

    if (!numeroTema) {
        btn.style.display = 'none';
        if (msgNoApuntes) msgNoApuntes.style.display = 'block';
        return;
    }

    const bucket = 'aprueba-e7242.firebasestorage.app';
    const cursoLogico = localStorage.getItem('userCourse') || localStorage.getItem('curso') || '';
    const TABLE = {
        '2eso': { quimica: 'apuntes_quimica_2eso', fisica: 'apuntes_fisica_2eso', matematicas: 'apuntes_mates_2eso' },
        '3eso': { quimica: 'apuntes_quimica_3eso', fisica: 'apuntes_fisica_3eso', matematicas: 'apuntes_mates_3eso' },
        '4eso': { quimica: 'apuntes_quimica_4eso', fisica: 'apuntes_fisica_4eso', matematicas: 'apuntes_mates_4eso' },
        '1bach': { quimica: 'apuntes_quimica_1bach', fisica: 'apuntes_fisica_1bach', matematicas: 'apuntes_mates_1bach' },
        '2bach': { quimica: 'apuntes_quimica_2bach', fisica: 'apuntes_fisica_2bach', matematicas: 'apuntes_mates_2bach' },
    };
    const cursoKey = Object.keys(TABLE).find(k => cursoLogico.includes(k)) || '2bach';
    const asigKey  = asignaturaLimpia === 'mates' ? 'matematicas' : asignaturaLimpia;
    const folder   = TABLE[cursoKey]?.[asigKey];

    if (!folder) {
        btn.style.display = 'none';
        if (msgNoApuntes) msgNoApuntes.style.display = 'block';
        return;
    }

    const prefixes = { quimica: 'quimica', fisica: 'fisica', matematicas: 'mates' };
    const fileName  = `${cursoKey.replace('bach', '_bach').replace('eso', '_eso')}_${prefixes[asigKey]}_T${numeroTema}.pdf`;
    const encodedPath = encodeURIComponent(`${folder}/${fileName}`);
    btn.href         = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    btn.style.display = 'inline-flex';
    if (msgNoApuntes) msgNoApuntes.style.display = 'none';
}

window.actualizarBotonApuntes = actualizarBotonApuntes;
