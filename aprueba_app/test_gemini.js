const { GoogleGenAI } = require('@google/genai');
const API_KEY = 'AIzaSyCQUIiCH7WjmZm5gHpWNwPA01LbtgAUPwU';
const ai = new GoogleGenAI({ apiKey: API_KEY });
const fs = require('fs');

async function testModel(modelName) {
    try {
        const response = await ai.models.generateContent({
            model: modelName.replace('models/', ''),
            contents: 'Hola, di "funciona"',
        });
        console.log(`✅ ${modelName} funciona!`);
        return true;
    } catch (e) {
        console.error(`❌ ${modelName} falló: ${e.message}`);
        return false;
    }
}

async function run() {
    const raw = fs.readFileSync('models.json', 'utf16le');
    const jsonStr = raw.substring(raw.indexOf('{'));
    const data = JSON.parse(jsonStr);
    const allModels = data.models || data;
    
    // Filtramos solo los de flash y que soporten generateContent
    let candidateModels = allModels
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name)
        .filter(name => name.includes('flash') && !name.includes('tts') && !name.includes('image'));
        
    // Pongamos al principio algunos prometedores
    const priority = ['models/gemini-3.5-flash', 'models/gemini-flash-latest', 'models/gemini-3-flash-preview'];
    
    candidateModels = [...new Set([...priority, ...candidateModels])];

    console.log("Probando modelos candidatos:", candidateModels);

    for (const model of candidateModels) {
        const success = await testModel(model);
        if (success) {
            console.log(`\n¡ENCONTRADO! El modelo que funciona perfectamente es: ${model}`);
            break;
        }
    }
}

run();
