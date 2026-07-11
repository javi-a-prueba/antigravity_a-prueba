// ── Tutor Socrático conectado a Firebase Cloud Functions (OpenAI) ──

// Historial de conversación para dar contexto
let chatHistory = [];

document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("chatInput");
    const button = document.querySelector(".chat-input button");

    // Sobrescribir evento de botón si existía
    button.onclick = sendMessage;
    chatInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            sendMessage();
        }
    });

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessageToChat("user", text);
        chatInput.value = "";

        showTypingIndicator();
        callSocraticTutor(text);
    }
});

function addMessageToChat(role, text) {
    const chatMessages = document.getElementById("chatMessages");
    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${role === 'user' ? 'user' : 'ai'}`;

    // Insertamos el texto respetando los saltos de línea (ideal si viene LaTeX básico o texto plano)
    msgDiv.innerHTML = text.replace(/\n/g, '<br>');

    chatMessages.appendChild(msgDiv);
    // Scroll automático
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById("chatMessages");
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg ai typing-indicator";
    msgDiv.innerHTML = "<span class='dot'></span><span class='dot'></span><span class='dot'></span>";
    msgDiv.id = "typingIndicator";
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
        indicator.remove();
    }
}

async function callSocraticTutor(userText) {
    // Añadimos el mensaje al historial local
    chatHistory.push({
        role: "user",
        parts: [{ text: userText }]
    });

    try {
        if (!window.socraticTutorCall) {
            setTimeout(() => {
                removeTypingIndicator();
                addMessageToChat("ai", "[Error] La conexión segura con el backend no está inicializada.");
            }, 1000);
            return;
        }

        // Obtener contexto del ejercicio activo
        const ejercicioActual = window.misionesActivas && window.misionesActivas[window.misionActualIndex]
            ? window.misionesActivas[window.misionActualIndex]
            : null;

        // Obtener texto del alumno si ha escrito algo en el textarea
        const textarea = document.getElementById("studentAnswerTextarea");
        const respuestaAlumno = textarea ? textarea.value.trim() : "";

        const payload = {
            curso: localStorage.getItem('userCourse') || 'Desconocido',
            asignatura: ejercicioActual?.asignatura || "General",
            bloque: ejercicioActual?.bloque || "General",
            enunciado: ejercicioActual?.enunciado || "No hay ejercicio activo.",
            pista: ejercicioActual?.pista || "Sin pista.",
            resolucion_latex: ejercicioActual?.resolucion_latex || "Sin resolución oficial.",
            respuestaAlumno: respuestaAlumno,
            mensaje: userText,
            historial: chatHistory
        };

        const result = await window.socraticTutorCall(payload);

        removeTypingIndicator();

        if (result && result.data && result.data.reply) {
            const aiText = result.data.reply;
            addMessageToChat("ai", aiText);

            // Renderizar LaTeX si se devuelve
            if (window.MathJax) {
                window.MathJax.typesetPromise([document.getElementById("chatMessages")]).catch(err => console.error(err));
            }

            chatHistory.push({
                role: "model",
                parts: [{ text: aiText }]
            });
        } else {
            console.error("Respuesta Fallida del Backend:", result);
            addMessageToChat("ai", "Lo siento, hubo un error de respuesta del servidor backend.");
            chatHistory.pop(); // Retirar para no romper
        }
    } catch (error) {
        removeTypingIndicator();
        addMessageToChat("ai", `Lo siento, hubo un error técnico o de permisos: ${error.message}`);
        console.error("Socratic Tutor API Request Error:", error);
        chatHistory.pop();
    }
}

// Función global exportada para ser llamada desde preguntas.js (el popup test o fallos)
window.triggerSocraticTutor = function (pregunta, opcionIncorrecta) {
    const simulatedMsg = `Me he equivocado. Pregunta: "${pregunta}". Mi respuesta fue: "${opcionIncorrecta}". Necesito entender mi error sin que me des la solución.`;

    // Inyectamos visualmente
    addMessageToChat("user", `Me he equivocado en: "${pregunta}". Elegí: "${opcionIncorrecta}". ¿Por qué?`);

    showTypingIndicator();
    callSocraticTutor(simulatedMsg);
};

window.downloadMissionPDF = function () {
    alert("Iniciando descarga: 'Misión_Física_Campo_Magnético.pdf'...");
};
/**
 * Actualiza la URL del botón de apuntes según la asignatura y el tema
 */
function actualizarBotonApuntes(tituloDelTema, asignaturaActual) {
    console.log("--- DEPILANDO BOTÓN APUNTES ---");
    console.log("Título recibido:", tituloDelTema);

    // Convertir asignatura a minúsculas por si acaso viene como "Quimica" o "FÍSICA"
    const asignaturaLimpia = (asignaturaActual || "").toLowerCase().trim();
    console.log("Asignatura recibida:", asignaturaLimpia);

    const btn = document.getElementById("btn-descargar-apuntes");
    const tabApuntes = document.getElementById("content-apuntes");
    const msgNoApuntes = document.getElementById("msg-no-apuntes");

    if (!btn) {
        console.log("Error: No se encontró el botón en el DOM");
        return;
    }

    // Nueva lógica robusta de extracción (Capa de persistencia)
    const urlParams = new URLSearchParams(window.location.search);
    const idUrl = urlParams.get('tema');

    // Extraer desde seleccion_temas si existe (útil en modo selección sin params en URL)
    let idSeleccion = null;
    try {
        const rawTemas = localStorage.getItem('seleccion_temas');
        if (rawTemas) {
            const temas = JSON.parse(rawTemas);
            if (Array.isArray(temas) && temas.length > 0) {
                idSeleccion = temas[0].id || temas[0].titulo;
            }
        }
    } catch (e) { }

    const idLocal = localStorage.getItem('tema_actual');

    // Prioridad de extracción profunda: 1. URL, 2. Array de selección, 3. Variable actual, 4. Título visual
    const identificadorReal = idUrl || idSeleccion || idLocal || tituloDelTema || "";
    console.log("Identificador real evaluado:", identificadorReal);

    // Extraer el primer bloque de números del identificador real
    const match = identificadorReal.match(/\d+/);
    const numeroTema = match ? match[0] : null;
    console.log("Número extraído:", numeroTema);

    if (!numeroTema) {
        console.log("Fallo: No se encontró ningún número en el título.");
        btn.style.display = "none";
        if (msgNoApuntes) msgNoApuntes.style.display = "block";
        return;
    }

    const bucket = "aprueba-e7242.firebasestorage.app";
    let folder = "";
    let fileName = "";
    let hayApuntes = false;

    // Lógica estricta para Química y Física de 2º Bach
    if (asignaturaLimpia === "quimica") {
        folder = "apuntes_quimica_2bach";
        fileName = `2_bach_quimica_T${numeroTema}.pdf`;
        hayApuntes = true;
    } else if (asignaturaLimpia === "fisica") {
        folder = "apuntes_fisica_2bach";
        fileName = `2_bach_fisica_T${numeroTema}.pdf`;
        hayApuntes = true;
    }

    if (hayApuntes) {
        const path = encodeURIComponent(`${folder}/${fileName}`);
        const finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media`;
        console.log("URL generada:", finalUrl);

        btn.href = finalUrl;
        btn.style.display = "inline-flex";
        if (msgNoApuntes) msgNoApuntes.style.display = "none";
    } else {
        console.log("Aviso: La asignatura no es ni 'fisica' ni 'quimica', o no tiene apuntes habilitados.");
        btn.style.display = "none";
        if (msgNoApuntes) msgNoApuntes.style.display = "block";
    }
}
