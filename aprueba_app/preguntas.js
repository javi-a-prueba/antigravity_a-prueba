// Lógica de Renderizado y Popups de Misiones UI (Fase 4 - IA Dinámica)

// Estado global para la interfaz de Misiones
window.misionesActivas = [];
window.misionActualIndex = 0;

// Constantes de IA manejadas dinámicamente mediante localStorage

window.iniciarMisiones = function() {
    if (!window.ejerciciosMision || window.ejerciciosMision.length === 0) {
        alert("Aún no se han cargado las misiones. Espera un momento o elige otro tema.");
        return;
    }
    
    window.misionesActivas = window.ejerciciosMision;
    window.misionActualIndex = 0;
    
    abrirMisionesNativas();
};

function abrirMisionesNativas() {
    document.getElementById("default-estudio-view").style.display = "none";
    const container = document.getElementById("misiones-inline-container");
    container.style.display = "flex";
    renderMisionActiva();
}

function cerrarMisionesNativas() {
    document.getElementById("misiones-inline-container").style.display = "none";
    document.getElementById("misiones-inline-container").innerHTML = "";
    document.getElementById("default-estudio-view").style.display = "block";
}

async function fetchIA(promptText) {
    const apiKey = typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : '';
    if (!apiKey) {
        return "[Error] API Key no configurada globalmente.";
    }
    const AI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(AI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error API de IA:", response.status, errorText);
            if (response.status === 400 && errorText.includes("API_KEY_INVALID")) {
                localStorage.removeItem('GEMINI_API_KEY');
                return "Error: API Key inválida. Recarga la página e introduce una nueva.";
            }
            return "Error al generar contenido. Revisa la consola para más detalles.";
        }
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        }
        console.error("Respuesta de IA sin candidates:", data);
        return "Error al generar contenido.";
    } catch (e) {
        console.error("Error de red en fetchIA:", e);
        return "Error de red al conectar con IA.";
    }
}

function renderMisionActiva() {
    const container = document.getElementById("misiones-inline-container");
    if (!container) return;
    container.innerHTML = ""; // Limpiar

    const ejercicio = window.misionesActivas[window.misionActualIndex];
    if (!ejercicio) return;

    const content = document.createElement("div");
    content.style.width = "100%";
    content.style.background = "rgba(20, 20, 38, 0.75)";
    content.style.border = "1px solid var(--current-neon, #00f2fe)";
    content.style.borderRadius = "24px";
    content.style.padding = "2.5rem";
    content.style.boxShadow = "0 10px 50px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 242, 254, 0.05)";
    content.style.position = "relative";
    content.style.display = "flex";
    content.style.flexDirection = "column";

    // --- CABECERA ---
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "2rem";
    header.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
    header.style.paddingBottom = "1rem";

    const titleInfo = document.createElement("div");
    
    const badge = document.createElement("span");
    badge.style.background = "var(--current-neon, #00f2fe)";
    badge.style.color = "#000";
    badge.style.padding = "0.3rem 0.8rem";
    badge.style.borderRadius = "50px";
    badge.style.fontSize = "0.8rem";
    badge.style.fontWeight = "bold";
    badge.style.textTransform = "uppercase";
    badge.style.marginRight = "1rem";
    badge.innerText = `Misión ${window.misionActualIndex + 1} de ${window.misionesActivas.length}`;

    const levelText = document.createElement("span");
    levelText.style.color = "#a0a0b8";
    levelText.style.fontSize = "0.95rem";
    levelText.innerText = `Nivel: ${ejercicio.nivel ? ejercicio.nivel.toUpperCase() : 'BÁSICO'}`;

    titleInfo.appendChild(badge);
    titleInfo.appendChild(levelText);

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "Abandonar Misión &times;";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "1px solid rgba(255,75,75,0.5)";
    closeBtn.style.color = "#ff4b4b";
    closeBtn.style.padding = "0.4rem 1rem";
    closeBtn.style.borderRadius = "20px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.transition = "all 0.3s";
    closeBtn.onclick = () => cerrarMisionesNativas();

    header.appendChild(titleInfo);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // --- ENUNCIADO ---
    const questionDiv = document.createElement("div");
    questionDiv.style.fontSize = "1.2rem";
    questionDiv.style.lineHeight = "1.7";
    questionDiv.style.color = "#ffffff";
    questionDiv.style.marginBottom = "2rem";
    questionDiv.innerHTML = `<p>${ejercicio.enunciado.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</p>`;
    content.appendChild(questionDiv);

    // --- TEXTAREA DEL ALUMNO ---
    const studentAnswerWrapper = document.createElement("div");
    studentAnswerWrapper.style.marginBottom = "2rem";

    const answerLabel = document.createElement("label");
    answerLabel.innerText = "Tu razonamiento o resultado (Obligatorio):";
    answerLabel.style.display = "block";
    answerLabel.style.color = "var(--current-neon, #00f2fe)";
    answerLabel.style.marginBottom = "0.5rem";
    answerLabel.style.fontSize = "0.95rem";
    answerLabel.style.fontWeight = "600";

    const textarea = document.createElement("textarea");
    textarea.id = "studentAnswerTextarea";
    textarea.placeholder = "Escribe aquí tu respuesta, razonamiento o resultado final para desbloquear la solución...";
    textarea.style.width = "100%";
    textarea.style.minHeight = "120px";
    textarea.style.background = "rgba(0, 0, 0, 0.3)";
    textarea.style.border = "1px solid rgba(255,255,255,0.2)";
    textarea.style.borderRadius = "12px";
    textarea.style.padding = "1rem";
    textarea.style.color = "#fff";
    textarea.style.fontSize = "1rem";
    textarea.style.resize = "vertical";
    textarea.style.fontFamily = "inherit";
    textarea.style.transition = "border 0.3s";

    studentAnswerWrapper.appendChild(answerLabel);
    studentAnswerWrapper.appendChild(textarea);
    content.appendChild(studentAnswerWrapper);

    // --- RESOLUCIÓN (OCULTA INICIALMENTE) ---
    const resolucionDiv = document.createElement("div");
    resolucionDiv.style.display = "none";
    resolucionDiv.style.background = "rgba(0, 0, 0, 0.5)";
    resolucionDiv.style.padding = "2rem";
    resolucionDiv.style.borderRadius = "12px";
    resolucionDiv.style.borderLeft = "4px solid var(--current-neon, #00f2fe)";
    resolucionDiv.style.marginBottom = "2rem";
    resolucionDiv.style.textAlign = "left";
    resolucionDiv.style.overflowX = "auto";
    resolucionDiv.innerHTML = `
        <p style="color: var(--current-neon, #00f2fe); margin-bottom: 1rem; font-weight: bold; font-size: 1.1rem;">Solución Paso a Paso:</p>
        <div style="font-size: 1.05rem; line-height: 1.6;">${(ejercicio.resolucion_latex || "Solución no disponible.").replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</div>
    `;

    // --- ZONA DE BOTONES DE APOYO ---
    const supportZone = document.createElement("div");
    supportZone.style.display = "flex";
    supportZone.style.gap = "1rem";
    supportZone.style.marginBottom = "2rem";
    supportZone.style.flexWrap = "wrap";

    const expandableContainer = document.createElement("div");
    expandableContainer.style.width = "100%";
    expandableContainer.style.display = "none";
    expandableContainer.style.marginBottom = "2rem";
    expandableContainer.style.padding = "1.5rem";
    expandableContainer.style.borderRadius = "12px";
    expandableContainer.style.background = "rgba(255,255,255,0.05)";
    expandableContainer.style.border = "1px solid rgba(255,255,255,0.1)";

    const btnPista = document.createElement("button");
    btnPista.className = "premium-btn";
    btnPista.style.background = "transparent";
    btnPista.style.border = "1px solid #fceabb";
    btnPista.style.color = "#fceabb";
    btnPista.innerHTML = "📡 Transmisión de Apoyo";
    
    const btnFormulas = document.createElement("button");
    btnFormulas.className = "premium-btn";
    btnFormulas.style.background = "transparent";
    btnFormulas.style.border = "1px solid #4facfe";
    btnFormulas.style.color = "#4facfe";
    btnFormulas.innerHTML = "🪐 Bitácora de Fórmulas";

    // Funciones de visualización de ayudas (Datos estáticos del JSON)
    btnPista.onclick = () => {
        expandableContainer.style.display = "block";
        expandableContainer.style.borderLeft = "4px solid #fceabb";
        expandableContainer.style.background = "rgba(255,255,255,0.05)";
        
        const pistaTexto = ejercicio.pista || "Pista no disponible para este ejercicio.";
        
        expandableContainer.innerHTML = `
            <h4 style="color: #fceabb; margin-bottom: 0.5rem;">📡 Transmisión Recibida</h4>
            <p style="color: #dcdcdc; font-size: 0.95rem; line-height: 1.5;">${pistaTexto}</p>
        `;
        if (window.MathJax) window.MathJax.typesetPromise([expandableContainer]);
    };

    btnFormulas.onclick = () => {
        // Lanzamos cohete
        const rocket = document.createElement("div");
        rocket.className = "rocket-anim";
        rocket.innerHTML = "🚀";
        // Posicionar sobre el botón
        const rect = btnFormulas.getBoundingClientRect();
        rocket.style.left = `${rect.left + rect.width/2 - 25}px`;
        rocket.style.top = `${rect.top}px`;
        document.body.appendChild(rocket);
        
        setTimeout(() => rocket.remove(), 1000); // limpiar

        expandableContainer.style.display = "block";
        expandableContainer.style.borderLeft = "4px solid #4facfe";
        expandableContainer.style.background = "rgba(79, 172, 254, 0.1)";

        expandableContainer.style.animation = "fadeIn 0.5s ease";
        // Leemos la fórmula directamente del ejercicio
        const formulaStr = ejercicio.formula || "Fórmula no disponible.";
        const latexLimpio = formulaStr.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '').trim();
        expandableContainer.innerHTML = `
            <h4 style="color: #4facfe; margin-bottom: 0.5rem; font-family: monospace;">Datos de Navegación Extraídos:</h4>
            <div style="text-align: center; font-size: 1.2rem; font-weight: bold; padding: 1rem; background: rgba(0,0,0,0.4); border-radius: 8px;">
                $$${latexLimpio}$$
            </div>
        `;
        if (window.MathJax) window.MathJax.typesetPromise([expandableContainer]);
    };

    supportZone.appendChild(btnPista);
    supportZone.appendChild(btnFormulas);
    content.appendChild(supportZone);
    content.appendChild(expandableContainer);
    content.appendChild(resolucionDiv);

    // --- ZONA DE ACCIÓN (EVALUACIÓN Y NAVEGACIÓN) ---
    const actionZone = document.createElement("div");
    actionZone.style.display = "flex";
    actionZone.style.flexDirection = "column";
    actionZone.style.alignItems = "center";
    actionZone.style.gap = "1.5rem";

    const btnEvaluar = document.createElement("button");
    btnEvaluar.className = "premium-btn";
    btnEvaluar.innerText = "Evaluar Misión";
    btnEvaluar.disabled = true;
    btnEvaluar.style.opacity = "0.5";
    btnEvaluar.style.cursor = "not-allowed";

    // Validación del Textarea
    textarea.addEventListener("input", () => {
        if (textarea.value.trim().length >= 1) {
            btnEvaluar.disabled = false;
            btnEvaluar.style.opacity = "1";
            btnEvaluar.style.cursor = "pointer";
            textarea.style.border = "1px solid var(--current-neon, #00f2fe)";
        } else {
            btnEvaluar.disabled = true;
            btnEvaluar.style.opacity = "0.5";
            btnEvaluar.style.cursor = "not-allowed";
        }
    });

    const evalResultContainer = document.createElement("div");
    evalResultContainer.style.display = "none";
    evalResultContainer.style.width = "100%";
    evalResultContainer.style.marginTop = "1rem";
    evalResultContainer.style.textAlign = "center";
    evalResultContainer.style.fontWeight = "bold";
    evalResultContainer.style.fontSize = "1.1rem";
    evalResultContainer.style.padding = "1rem";
    evalResultContainer.style.borderRadius = "8px";

    // Navegación Inferior
    const navZone = document.createElement("div");
    navZone.style.display = "flex";
    navZone.style.justifyContent = "space-between";
    navZone.style.width = "100%";
    navZone.style.marginTop = "2rem";
    navZone.style.borderTop = "1px solid rgba(255,255,255,0.1)";
    navZone.style.paddingTop = "1.5rem";

    const btnAtras = document.createElement("button");
    btnAtras.className = "option-btn";
    btnAtras.innerText = "⬅ Atrás";
    btnAtras.style.background = "rgba(255,255,255,0.05)";
    btnAtras.onclick = () => {
        if (window.misionActualIndex > 0) {
            window.misionActualIndex--;
            renderMisionActiva();
        } else {
            cerrarMisionesNativas();
        }
    };

    const btnSiguiente = document.createElement("button");
    btnSiguiente.className = "option-btn";
    btnSiguiente.innerText = "Siguiente ➡";
    btnSiguiente.style.background = "rgba(255,255,255,0.05)";
    btnSiguiente.disabled = true; // CONDICIÓN ESTRICTA: Bloqueado inicialmente
    btnSiguiente.style.opacity = "0.4";
    btnSiguiente.style.cursor = "not-allowed";

    btnSiguiente.onclick = () => {
        if (!btnSiguiente.disabled) {
            if (window.misionActualIndex < window.misionesActivas.length - 1) {
                window.misionActualIndex++;
                renderMisionActiva();
            } else {
                alert("¡Has completado todas las misiones prácticas de este bloque!");
                cerrarMisionesNativas();
            }
        }
    };

    navZone.appendChild(btnAtras);
    navZone.appendChild(btnSiguiente);

    let intentos = 0;

    // Eventos de Evaluación Automática
    btnEvaluar.onclick = async () => {
        textarea.disabled = true; // Fijamos su respuesta temporalmente
        textarea.style.background = "rgba(0,0,0,0.5)";
        btnEvaluar.innerText = "Analizando respuesta... ⚙️";
        btnEvaluar.disabled = true;
        expandableContainer.style.display = "none"; // Ocultar pistas
        
        const promptText = `Eres un corrector de matemáticas y física muy flexible. Tu único objetivo es comprobar si la RESPUESTA FINAL del alumno es matemáticamente equivalente al resultado de la solución proporcionada. Ignora si el alumno no ha puesto el desarrollo. Acepta variaciones de nomenclatura (ej. "pi" en lugar del símbolo, espacios por asteriscos, orden de los factores). Si es correcta o equivalente, responde ÚNICAMENTE con la palabra TRUE. Si es incorrecta, responde ÚNICAMENTE con la palabra FALSE.

Enunciado: ${ejercicio.enunciado}
Solución oficial: ${ejercicio.resolucion_latex}
Respuesta del alumno: ${textarea.value}`;

        let resultadoIA = await fetchIA(promptText);
        // Limpieza de Markdown si lo hubiera
        resultadoIA = resultadoIA.replace(/```/g, "").trim().toUpperCase();
        const esCorrecto = resultadoIA.includes("TRUE");

        if (esCorrecto) {
            btnEvaluar.style.display = "none";
            evalResultContainer.style.display = "block";
            resolucionDiv.style.display = "block";
            evalResultContainer.style.background = "rgba(56, 239, 125, 0.2)";
            evalResultContainer.style.color = "#38ef7d";
            evalResultContainer.style.border = "1px solid #38ef7d";
            evalResultContainer.innerHTML = "¡Misión Cumplida! Respuesta correcta. 🚀";
            if(window.guardarProgresoAcierto) {
                window.guardarProgresoAcierto(1.0, false, ejercicio.bloque, ejercicio.id_doc);
            }
            desbloquearSiguiente(btnSiguiente);
            if (window.MathJax) {
                window.MathJax.typesetPromise([resolucionDiv]).catch(err => console.error(err));
            }
        } else {
            intentos++;
            if (intentos === 1) {
                // Primer fallo: Mostrar pista y permitir reintentar
                evalResultContainer.style.display = "block";
                evalResultContainer.style.background = "rgba(242, 201, 76, 0.2)";
                evalResultContainer.style.color = "#f2c94c";
                evalResultContainer.style.border = "1px solid #f2c94c";
                evalResultContainer.innerHTML = "Generando salvavidas... 🛟";
                
                const promptPista = `El alumno ha fallado en este problema. Basado en su respuesta ("${textarea.value}") y la solución oficial ("${ejercicio.resolucion_latex}"), dale una pista BREVE (1 o 2 líneas) que le ayude a ver su error sin darle el resultado final. Si su respuesta está completamente vacía o no tiene sentido, dale una pista genérica para empezar.`;
                const pista = await fetchIA(promptPista);
                
                evalResultContainer.innerHTML = `<strong>Casi lo tienes (Intento 1/2).</strong><br>Pista del sistema: ${pista}`;
                
                // Permitir reintentar
                textarea.disabled = false;
                textarea.style.background = "rgba(0, 0, 0, 0.3)";
                btnEvaluar.innerText = "Reevaluar Misión";
                btnEvaluar.disabled = false;
            } else {
                // Segundo fallo definitivo
                btnEvaluar.style.display = "none";
                evalResultContainer.style.display = "block";
                resolucionDiv.style.display = "block";
                evalResultContainer.style.background = "rgba(239, 71, 58, 0.2)";
                evalResultContainer.style.color = "#ef473a";
                evalResultContainer.style.border = "1px solid #ef473a";
                evalResultContainer.innerHTML = "¡Vaya! La respuesta no es correcta. Revisa la solución paso a paso e inténtalo de nuevo en la siguiente vuelta. 🛰️";
                
                if(window.guardarProgresoFallo) {
                    window.guardarProgresoFallo(ejercicio.bloque, ejercicio.id_doc);
                }
                desbloquearSiguiente(btnSiguiente);
                if (window.MathJax) {
                    window.MathJax.typesetPromise([resolucionDiv]).catch(err => console.error(err));
                }
            }
        }
    };

    actionZone.appendChild(btnEvaluar);
    actionZone.appendChild(evalResultContainer);
    
    content.appendChild(actionZone);
    content.appendChild(navZone);
    container.appendChild(content);

    // Primer renderizado de LaTeX (enunciado)
    if (window.MathJax) {
        window.MathJax.typesetPromise([questionDiv]).catch(err => console.error(err));
    }
}

function desbloquearSiguiente(btnSiguiente) {
    btnSiguiente.disabled = false;
    btnSiguiente.style.opacity = "1";
    btnSiguiente.style.cursor = "pointer";
    btnSiguiente.style.background = "var(--current-neon, #00f2fe)";
    btnSiguiente.style.color = "#000";
    btnSiguiente.style.fontWeight = "bold";
}
