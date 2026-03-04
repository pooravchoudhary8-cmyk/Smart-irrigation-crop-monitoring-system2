import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const SOIL_API_URL = process.env.SOIL_API_URL || "http://localhost:8002";

class SoilService {
    /**
     * Classifies soil type from an image buffer
     * @param {Buffer} imageBuffer - The image data
     * @param {string} filename - Filename for the multipart form
     * @returns {Promise<Object>} - The classification result
     */
    async classifySoil(imageBuffer, filename) {
        console.log(`📡 [Soil Service] Classifying image: ${filename} (${imageBuffer.length} bytes)`);

        try {
            const formData = new FormData();
            formData.append('file', imageBuffer, {
                filename: filename || 'soil_sample.jpg',
                contentType: 'image/jpeg',
            });

            console.log(`🔗 [Soil Service] Posting to: ${SOIL_API_URL}/soil/predict`);
            const response = await axios.post(`${SOIL_API_URL}/soil/predict`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                timeout: 30000, // 30s timeout
            });

            console.log(`✅ [Soil Service] Classified as: ${response.data.prediction}`);
            return response.data;
        } catch (error) {
            const fs = await import('fs');
            const errorMessage = error.response ?
                `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}` :
                error.message;

            fs.appendFileSync('soil_error_log.txt', `${new Date().toISOString()} - Error: ${errorMessage}\n`);
            console.error('❌ [Soil Service] Error:', errorMessage);
            throw new Error(`Failed to classify soil sample: ${errorMessage}`);
        }
    }

    /**
     * Gets available soil labels from the model
     */
    async getLabels() {
        try {
            const response = await fetch(`${SOIL_API_URL}/soil/labels`);
            if (!response.ok) throw new Error('Failed to fetch labels');
            return await response.json();
        } catch (error) {
            console.error('Error fetching soil labels:', error.message);
            return { labels: ["Alluvial soil", "Black Soil", "Clay soil", "Red soil", "Sandy soil", "Loamy soil"], count: 6 };
        }
    }
}

export const soilService = new SoilService();
