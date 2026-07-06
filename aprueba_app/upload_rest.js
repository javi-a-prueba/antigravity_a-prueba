const docs = [
  {
    id: "andalucia_matematicas",
    matiz_revisor: "Fijación con áreas en R3 y producto vectorial. Mucha atención a parámetros en funciones a trozos",
    tema_estrella: "Geometría en el Espacio"
  },
  {
    id: "aragon_matematicas",
    matiz_revisor: "Exámenes muy largos. Debes dominar la discusión de sistemas con parámetros (a, m, k)",
    tema_estrella: "Sistemas de Ecuaciones"
  },
  {
    id: "asturias_matematicas",
    matiz_revisor: "Análisis denso. Integrales complejas con funciones exponenciales y logarítmicas",
    tema_estrella: "Integrales Definidas"
  },
  {
    id: "cantabria_matematicas",
    matiz_revisor: "Rigor formal extremo. Define siempre los sucesos y usa notación de conjuntos (Leyes de Morgan)",
    tema_estrella: "Probabilidad"
  },
  {
    id: "castilla-la-mancha_matematicas",
    matiz_revisor: "¡Atención! Especifica el Dominio antes de derivar o integrar o restarán puntos directamente",
    tema_estrella: "Aplicaciones de la Derivada"
  },
  {
    id: "castilla-y-leon_matematicas",
    matiz_revisor: "Nivel alto en Álgebra. Exigen un despeje matricial impecable antes de operar",
    tema_estrella: "Matrices"
  },
  {
    id: "cataluna_matematicas",
    matiz_revisor: "Enfoque aplicado. Problemas de optimización basados en contextos reales y prácticos",
    tema_estrella: "Optimización"
  },
  {
    id: "comunidad-valenciana_matematicas",
    matiz_revisor: "Representación estricta. Exigen dibujo preciso de asíntotas, monotonía y curvatura",
    tema_estrella: "Representación de Funciones"
  },
  {
    id: "galicia_matematicas",
    matiz_revisor: "Teoría pura. Es obligatorio nombrar y escribir las hipótesis de los teoremas (Bolzano, Rouché, etc.)",
    tema_estrella: "Teoremas de Continuidad"
  },
  {
    id: "madrid_matematicas",
    matiz_revisor: "Geometría Métrica (distancias y simétricos) y ejercicio cerrado de Teorema de Bayes",
    tema_estrella: "Geometría Métrica"
  },
  {
    id: "pais-vasco_matematicas",
    matiz_revisor: "Interpretación física. Suelen pedir integrar la velocidad para hallar el espacio recorrido",
    tema_estrella: "Integrales Aplicadas"
  },
  {
    id: "murcia_matematicas",
    matiz_revisor: "Análisis minucioso. Precisión total en límites aplicando L'Hôpital varias veces",
    tema_estrella: "Límites"
  }
];

const temasArray = [
  { "stringValue": "1. Matrices" }, { "stringValue": "2. Determinantes" }, { "stringValue": "3. Sistemas de Ecuaciones" },
  { "stringValue": "4. Vectores en el Espacio" }, { "stringValue": "5. Puntos, Rectas y Planos" }, { "stringValue": "6. Posiciones Relativas" },
  { "stringValue": "7. Geometría Métrica" }, { "stringValue": "8. Límites y Continuidad" }, { "stringValue": "9. Derivadas" },
  { "stringValue": "10. Aplicaciones de la Derivada" }, { "stringValue": "11. Representación de Funciones" }, { "stringValue": "12. Integrales Indefinidas" },
  { "stringValue": "13. Integrales Definidas" }, { "stringValue": "14. Probabilidad (Bayes/Total)" }, { "stringValue": "15. Distribuciones (Binomial/Normal)" }
];

async function uploadAll() {
  for (const doc of docs) {
    const url = `https://firestore.googleapis.com/v1/projects/aprueba-webapp/databases/(default)/documents/temarios/${doc.id}`;
    
    const bodyObj = {
      fields: {
        lista_temas: { arrayValue: { values: temasArray } },
        matiz_revisor: { stringValue: doc.matiz_revisor },
        tema_estrella: { stringValue: doc.tema_estrella },
        curso: { stringValue: "2_bachillerato" }
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
        console.error(`Error uploading ${doc.id}:`, data.error.message);
      } else {
        console.log(`Successfully uploaded: ${doc.id}`);
      }
    } catch (err) {
      console.error(`Fetch failed for ${doc.id}:`, err);
    }
  }
}

uploadAll();
