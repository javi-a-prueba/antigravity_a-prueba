// Script de carga masiva: Física 2º Bachillerato → Firestore
// Ejecutar con: node upload_fisica.js  (en el directorio del proyecto)
// Requiere: node-fetch  → npm install node-fetch  (si lo lanzas en Node < 18)
// O bien, pégalo en la consola del navegador a través de un HTML auxiliar.

const PROJECT_ID = "aprueba-webapp";

const temasArray = [
  { stringValue: "1. Interacción Gravitatoria (Campo y Potencial)" },
  { stringValue: "2. Movimiento de Planetas y Satélites" },
  { stringValue: "3. Interacción Electrostática (Ley de Coulomb y Gauss)" },
  { stringValue: "4. Campo Eléctrico y Potencial" },
  { stringValue: "5. Magnetismo y Fuentes de Campo" },
  { stringValue: "6. Inducción Electromagnética (Faraday y Lenz)" },
  { stringValue: "7. Movimiento Armónico Simple (M.A.S.)" },
  { stringValue: "8. Ondas y Fenómenos Ondulatorios" },
  { stringValue: "9. Óptica Geométrica (Espejos y Lentes)" },
  { stringValue: "10. Óptica Física (Naturaleza de la luz)" },
  { stringValue: "11. Física Relativista y Cuántica (Fotones / De Broglie)" },
  { stringValue: "12. Física Nuclear (Radiactividad y Energía de Enlace)" }
];

const docs = [
  {
    id: "andalucia_fisica",
    matiz_revisor: "Enfoque práctico en Inducción y Campo Magnético. Ojo con los signos en el flujo magnético",
    tema_estrella: "Inducción Electromagnética"
  },
  {
    id: "aragon_fisica",
    matiz_revisor: "Problemas muy extensos de Gravitación. Exigen dibujo vectorial impecable en cada paso",
    tema_estrella: "Interacción Gravitatoria"
  },
  {
    id: "asturias_fisica",
    matiz_revisor: "Obsesión por la Óptica Geométrica y el trazado de rayos. No vale solo el cálculo, el dibujo debe ser a escala",
    tema_estrella: "Óptica Geométrica"
  },
  {
    id: "cantabria_fisica",
    matiz_revisor: "Rigor en Física Moderna. Debes explicar perfectamente el Efecto Fotoeléctrico y la hipótesis de De Broglie",
    tema_estrella: "Física Cuántica"
  },
  {
    id: "castilla-la-mancha_fisica",
    matiz_revisor: "Cuidado con el bloque de Ondas. Piden siempre la ecuación de la onda armónica y desfases",
    tema_estrella: "Ondas"
  },
  {
    id: "cataluna_fisica",
    matiz_revisor: "Contexto real. Suelen poner problemas de satélites actuales o aceleradores de partículas (CERN)",
    tema_estrella: "Campo Eléctrico y Magnético"
  },
  {
    id: "comunidad-valenciana_fisica",
    matiz_revisor: "Precisión en el M.A.S. y energías. Exigen distinguir entre energía cinética, potencial y mecánica con gráficas",
    tema_estrella: "Movimiento Armónico Simple"
  },
  {
    id: "galicia_fisica",
    matiz_revisor: "Justificación teórica obligatoria. Debes enunciar las leyes (Kepler, Newton, Faraday) antes de aplicarlas",
    tema_estrella: "Leyes de la Naturaleza"
  },
  {
    id: "madrid_fisica",
    matiz_revisor: "Foco total en Campo Gravitatorio y Física Nuclear (Periodo de semidesintegración)",
    tema_estrella: "Física Nuclear"
  },
  {
    id: "pais-vasco_fisica",
    matiz_revisor: "Interpretación energética. Priorizan el uso del Teorema de las Fuerzas Vivas en problemas de campos",
    tema_estrella: "Trabajo y Energía"
  },
  {
    id: "murcia_fisica",
    matiz_revisor: "Interferencia y Difracción. Piden mucho detalle en la naturaleza ondulatoria de la luz",
    tema_estrella: "Óptica Física"
  }
];

async function uploadAll() {
  console.log(`🚀 Iniciando carga de ${docs.length} documentos de Física...`);
  for (const docData of docs) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/temarios/${docData.id}`;

    const bodyObj = {
      fields: {
        lista_temas: {
          arrayValue: {
            values: temasArray.map(t => ({ stringValue: t.stringValue }))
          }
        },
        matiz_revisor: { stringValue: docData.matiz_revisor },
        tema_estrella: { stringValue: docData.tema_estrella },
        curso:         { stringValue: "2_bachillerato" },
        asignatura:    { stringValue: "fisica" }
      }
    };

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj)
      });
      const data = await res.json();
      if (data.error) {
        console.error(`❌ Error subiendo ${docData.id}:`, data.error.message);
      } else {
        console.log(`✅ Subido: ${docData.id}`);
      }
    } catch (err) {
      console.error(`💥 Fetch falló para ${docData.id}:`, err);
    }
  }
  console.log("🎯 Carga de Física completada.");
}

uploadAll();
