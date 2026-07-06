import fs from 'fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync } from 'fs';

// 1. Configuración de Firebase Admin
// Asumimos que la Service Account está en el mismo directorio (serviceAccountKey.json)
let serviceAccount;
const serviceAccountPath = './serviceAccountKey.json';

try {
    if (existsSync(serviceAccountPath)) {
        const fileData = await fs.readFile(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(fileData);
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log("✅ Conectado a Firebase como Administrador usando serviceAccountKey.json");
    } else {
        // Intenta usar las credenciales por defecto de la aplicación
        initializeApp();
        console.log("✅ Conectado a Firebase como Administrador usando Credenciales por Defecto.");
    }
} catch (err) {
    console.error("❌ ERROR al inicializar Firebase Admin. Asegúrate de tener el archivo serviceAccountKey.json en este directorio.");
    console.error(err.message);
    process.exit(1);
}

const db = getFirestore();

// 2. Argumentos de terminal
const filePathArg = process.argv[2];
const prefixArg = process.argv[3];

if (!filePathArg || !prefixArg) {
    console.error("❌ ERROR: Faltan argumentos.");
    console.error("Uso correcto: node upload_ejercicios.mjs <archivo.json> <prefijo_>");
    console.error("Ejemplo: node upload_ejercicios.mjs mates_2bach.json mat_");
    process.exit(1);
}

// 3. Mapeo estricto de dificultad a nivel
const mapNivel = {
    'Fácil': 'bronce',
    'Básica': 'bronce',
    'Media': 'plata',
    'Difícil': 'oro',
    'Alta': 'oro',
    'Superior': 'supernova'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function uploadEjercicios() {
    try {
        if (!existsSync(filePathArg)) {
            console.error(`❌ ERROR: No se ha encontrado el archivo '${filePathArg}'.`);
            process.exit(1);
        }

        const finalPath = filePathArg;
        const fileContent = await fs.readFile(finalPath, 'utf8');
        let ejercicios = [];
        
        try {
            ejercicios = JSON.parse(fileContent);
        } catch (err) {
            console.error(`❌ Error al parsear el JSON:`, err.message);
            process.exit(1);
        }

        console.log(`Se han encontrado ${ejercicios.length} ejercicios. Comenzando la subida a Firestore como ADMINISTRADOR...`);

        // Usar un bucle. Como es admin, es muy rápido y estable, pero mantenemos un ligero retardo por seguridad.
        for (const ejercicio of ejercicios) {
            if (ejercicio.dificultad && mapNivel[ejercicio.dificultad]) {
                ejercicio.nivel = mapNivel[ejercicio.dificultad];
                delete ejercicio.dificultad;
            }

            let temaId = 'tema_desconocido';
            if (ejercicio.bloque) {
                const match = ejercicio.bloque.match(/\d+/);
                if (match) {
                    temaId = `tema_${match[0]}`;
                }
            }
            ejercicio.tema_id = temaId;

            const docId = `${prefixArg}${ejercicio.id}`;
            const docRef = db.collection('ejercicios_base').doc(docId);
            
            try {
                await docRef.set(ejercicio);
                console.log(`  ✅ Subido: [${docId}] -> Transformado a: ${temaId}`);
            } catch (e) {
                console.log(`  ❌ Fallo en [${docId}]: ${e.message}. Reintentando en 2s...`);
                await sleep(2000);
                await docRef.set(ejercicio);
                console.log(`  ✅ Reintento Exitoso: [${docId}]`);
            }
            await sleep(100); // Admin SDK no suele fallar, pero un pequeño retardo nunca está de más
        }
        
        console.log(`\n🚀 ¡ÉXITO! Se han subido ${ejercicios.length} ejercicios a la colección 'ejercicios_base'.`);
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Error crítico durante la subida:", error);
        process.exit(1);
    }
}

uploadEjercicios();
