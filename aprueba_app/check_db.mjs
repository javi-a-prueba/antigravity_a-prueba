import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';

const serviceAccount = JSON.parse(await fs.readFile('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
    const snap = await db.collection('ejercicios_base').where('asignatura', '==', 'Física 2º ESO').get();
    console.log("Física 2º ESO count:", snap.size);
    const snap2 = await db.collection('ejercicios_base').where('asignatura', '==', 'Física 1º Bach').get();
    console.log("Física 1º Bach count:", snap2.size);
}
check();
