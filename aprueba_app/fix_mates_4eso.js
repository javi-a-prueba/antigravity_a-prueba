const fs = require('fs');
let data = fs.readFileSync('mates_4eso.json', 'utf8');
data = data.replace(/"asignatura": "Matemáticas 4º ESO B"/g, '"asignatura": "Matemáticas 4º ESO"');
fs.writeFileSync('mates_4eso.json', data);
console.log('Done!');
