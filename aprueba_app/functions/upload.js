const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

const mapNivel = {
    'Fácil': 'bronce',
    'Básica': 'bronce',
    'Media': 'plata',
    'Difícil': 'oro',
    'Alta': 'oro',
    'Superior': 'supernova'
};

async function uploadEjercicios() {
    const fileContent = fs.readFileSync('../mates_4eso.json', 'utf8');
    const ejercicios = JSON.parse(fileContent);

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

        const docId = `m_4eso_${ejercicio.id}`;
        await db.collection('ejercicios_base').doc(docId).set(ejercicio);
        console.log(`Subido: ${docId}`);
    }
    console.log("¡ÉXITO!");
}

uploadEjercicios().catch(console.error);
