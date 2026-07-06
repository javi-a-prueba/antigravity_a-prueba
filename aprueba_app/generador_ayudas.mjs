import fs from 'fs';

// Intentar extraer la API KEY de config.js para no tener que copiarla
let GEMINI_API_KEY = "PON_TU_API_KEY_AQUI";
try {
    const configContent = fs.readFileSync('config.js', 'utf8');
    const match = configContent.match(/GEMINI_API_KEY\s*=\s*["']([^"']+)["']/);
    if (match) {
        GEMINI_API_KEY = match[1];
        console.log("✅ API Key cargada desde config.js");
    }
} catch (e) {
    console.log("⚠️ No se pudo leer config.js automáticamente.");
}

const AI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Añade a este array todos los archivos JSON de tu base de datos local
const archivosJSON = [
    'fisica_1bach.json',
    'fisica_2bach.json',
    'fisica_2eso.json',
    'fisica_3eso.json',
    'fisica_4eso.json',
    'quimica_1bach.json',
    'quimica_2bach.json',
    'quimica_2eso.json',
    'quimica_3eso.json',
    'quimica_4eso.json',
    'mates_1bach.json',
    'mates_2bach.json',
    'mates_2eso.json',
    'mates_3eso.json',
    'mates_4eso.json'
];

async function generarAyudasParaArchivo(archivo) {
    try {
        console.log(`\nProcesando archivo: ${archivo}`);
        const data = fs.readFileSync(archivo, 'utf8');
        const ejercicios = JSON.parse(data);
        let modificados = 0;

        for (let i = 0; i < ejercicios.length; i++) {
            const ej = ejercicios[i];

            if (!ej.pista || !ej.formula) {
                console.log(`Generando ayudas para ejercicio ${ej.id} (${i + 1}/${ejercicios.length})...`);
                
                const prompt = `Analiza este problema y su resolución. Genera dos cosas: 1) Una "pista" sutil para ayudar al alumno sin darle la solución. 2) La "formula" principal en formato LaTeX necesaria para resolverlo. Devuelve ÚNICAMENTE un objeto JSON con este formato exacto: {"pista": "texto", "formula": "texto LaTeX"}. No incluyas markdown ni comillas invertidas.\n\nEnunciado: ${ej.enunciado}\n\nSolución: ${ej.resolucion_latex}`;

                let success = false;
                while (!success) {
                    try {
                        const response = await fetch(AI_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                        });

                        if (response.status === 429) {
                            console.warn(`⚠️ Error 429 (Too Many Requests) en ejercicio ${ej.id}. Pausando 60 segundos...`);
                            await new Promise(resolve => setTimeout(resolve, 60000));
                            continue; // Reintenta la misma petición
                        }

                        if (!response.ok) {
                            console.error(`Error en la API para el ejercicio ${ej.id}:`, response.status, await response.text());
                            break; // Error grave distinto a 429, saltar ejercicio
                        }

                        const jsonResp = await response.json();
                        
                        if (jsonResp.candidates && jsonResp.candidates.length > 0) {
                            const textoIA = jsonResp.candidates[0].content.parts[0].text;
                            try {
                                const jsonText = textoIA.replace(/```json/g, '').replace(/```/g, '').trim();
                                const ayudaData = JSON.parse(jsonText);
                                
                                if (!ej.pista) ej.pista = ayudaData.pista || "Pista no disponible.";
                                if (!ej.formula) ej.formula = ayudaData.formula || "Fórmula no disponible.";
                                
                                modificados++;
                                console.log(`✅ Ejercicio ${ej.id} actualizado.`);
                            } catch(err) {
                                console.error(`❌ Error parseando la respuesta del ejercicio ${ej.id}:`, textoIA);
                            }
                        } else {
                            console.error(`❌ Respuesta inesperada de Gemini para el ejercicio ${ej.id}:`, jsonResp);
                        }

                        success = true;
                        // Pausa obligatoria base de 15 segundos (15000 ms) entre peticiones exitosas
                        console.log("Esperando 15 segundos para no saturar la API...");
                        await new Promise(resolve => setTimeout(resolve, 15000));

                    } catch (fetchErr) {
                        console.error(`Error de red al procesar ejercicio ${ej.id}:`, fetchErr);
                        break;
                    }
                }
            } else {
                console.log(`⏩ Ejercicio ${ej.id} ya tiene pista y fórmula. Saltando...`);
            }
        }

        if (modificados > 0) {
            fs.writeFileSync(archivo, JSON.stringify(ejercicios, null, 2), 'utf8');
            console.log(`\n🎉 Archivo ${archivo} guardado con éxito. Se modificaron ${modificados} ejercicios.`);
        } else {
            console.log(`\nNo hubo cambios en el archivo ${archivo}.`);
        }
    } catch (e) {
        console.error(`Error procesando ${archivo}:`, e);
    }
}

async function main() {
    for (const archivo of archivosJSON) {
        if (fs.existsSync(archivo)) {
            await generarAyudasParaArchivo(archivo);
        } else {
            console.log(`⚠️ Archivo ${archivo} no encontrado, saltando...`);
        }
    }
    console.log("\nProceso terminado completo.");
}

main();
