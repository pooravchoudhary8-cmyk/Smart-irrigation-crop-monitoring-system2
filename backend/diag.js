
import fs from 'fs';
import os from 'os';

const diag = {
    nodeVersion: process.version,
    platform: process.platform,
    env: {
        PORT: process.env.PORT,
        SOIL_API_URL: process.env.SOIL_API_URL
    },
    exists: {
        soil_service: fs.existsSync('./src/services/soil.service.js'),
        soil_classifier: fs.existsSync('../soil_classifier/soil_service.py')
    }
};

fs.writeFileSync('node_diag.json', JSON.stringify(diag, null, 2));
console.log('Diagnostic written to node_diag.json');
