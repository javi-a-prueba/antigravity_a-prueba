const API_KEY = 'AIzaSyCQUIiCH7WjmZm5gHpWNwPA01LbtgAUPwU';

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        console.log("Modelos disponibles:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error al obtener modelos:", e);
    }
}

listModels();
