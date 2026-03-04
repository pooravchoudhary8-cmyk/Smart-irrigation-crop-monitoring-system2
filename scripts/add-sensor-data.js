// Simple test script to add sensor data to MongoDB
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://127.0.0.1:27017/smart_irrigation';

// Define schema inline
const sensorSchema = new mongoose.Schema(
    {
        soil_moisture: Number,
        temperature: Number,
        humidity: Number,
        rainfall: Number,
        crop_stage: Number
    },
    { timestamps: true }
);

const Sensor = mongoose.model('Sensor', sensorSchema);

async function addData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected!\n');

        // Add fresh data
        const newData = {
            soil_moisture: 45,
            temperature: 28,
            humidity: 65,
            rainfall: 2,
            crop_stage: 3
        };

        const sensor = new Sensor(newData);
        await sensor.save();

        console.log('✅ Added sensor data:');
        console.log(`   Soil Moisture: ${newData.soil_moisture}%`);
        console.log(`   Temperature: ${newData.temperature}°C`);
        console.log(`   Humidity: ${newData.humidity}%\n`);

        // Show all data
        const all = await Sensor.find().sort({ createdAt: -1 }).limit(5);
        console.log(`📊 Total records in database: ${await Sensor.countDocuments()}`);
        console.log('\n Most recent 5 entries:');
        all.forEach((item, i) => {
            console.log(`   ${i + 1}. Moisture: ${item.soil_moisture}% | Temp: ${item.temperature}°C | Humidity: ${item.humidity}%`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Done!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

addData();
