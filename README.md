# Smart Irrigation System (AgroSense)

## 📋 Project Overview

The **Smart Irrigation System** is an AI-powered agricultural technology platform designed to optimize water usage and maximize crop yield through intelligent irrigation recommendations. The system leverages machine learning, IoT sensor integration, and real-time data analytics to help farmers make data-driven decisions about irrigation scheduling and resource management.

### 🎯 Key Objectives

- **Water Conservation**: Reduce water wastage through intelligent irrigation recommendations
- **Crop Optimization**: Maximize yield by analyzing soil, weather, and environmental conditions
- **IoT Integration**: Seamlessly integrate with soil moisture sensors, weather stations, and smart irrigation controllers
- **User-Friendly Interface**: Provide farmers with accessible dashboards and actionable insights
- **Scalability**: Support multiple farms and irrigation zones with zone-based intelligence

---

## � Frontend Demo

### Application Interface

Here's a preview of the Smart Irrigation System user interface:

![Frontend Dashboard](./image-1772153964925.png)

The dashboard provides farmers with:
- Real-time sensor data visualization
- Irrigation recommendations and scheduling
- Historical data and analytics
- Zone management and monitoring
- User profile and settings management

---

## �🏗️ Architecture Overview

The project is built using a **modular, full-stack architecture** with multiple specialized components:

### Core Modules

1. **Frontend** (`frontend/`) - React/Vue-based web application with user dashboards
2. **Backend** (`backend/`) - Node.js/Express API server for data management and authentication
3. **Intelligence Engine** (`intelligence_engine/`) - Python-based AI/ML core for recommendations
4. **ML Models** (`ml_models/`) - Pre-trained models for irrigation and yield prediction
5. **IoT Integration** (`iot/`) - IoT device communication and data aggregation
6. **RAG System** (`rag/`) - Retrieval-Augmented Generation for intelligent context retrieval
7. **Chatbot** (`NewChatbot/`) - Conversational AI for farmer support and guidance
8. **Soil Classifier** (`soil_classifier/`) - ML-based soil classification system
9. **MongoDB Data** (`mongodb_data/`) - Database storage layer

---

## 📦 Technology Stack

### Frontend
- **Framework**: Vite + JavaScript/React
- **Styling**: PostCSS + Tailwind/CSS
- **State Management**: Authentication service
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: Google OAuth2 + Custom JWT
- **Database**: MongoDB
- **Utilities**: Crypto, Zero-dependency patterns

### Intelligence Engine
- **Language**: Python
- **ML Frameworks**: TensorFlow/PyTorch
- **Data Processing**: Pandas, NumPy
- **RAG**: Chromadb for vector storage

### ML Models
- **Irrigation Prediction Model**: Predicts optimal watering schedules
- **Yield Prediction Model**: Estimates crop yield based on conditions
- **Soil Classification**: Identifies soil types using deep learning

### Additional Systems
- **Chatbot**: Python-based NLP for farmer assistance
- **IoT Communication**: Device integration protocols
- **RL Training**: Reinforcement learning for adaptive irrigation strategies

---

## 📁 Directory Structure

```
├── frontend/                    # React/Vite client application
│   ├── client/                 # Client source code
│   ├── server/                 # Development server
│   ├── shared/                 # Shared schema and utilities
│   └── script/                 # Build scripts
│
├── backend/                     # Node.js/Express server
│   └── src/
│       ├── app.js              # Main application file
│       ├── Component/          # Reusable components
│       ├── config/             # Configuration files
│       ├── controller/         # API controllers
│       ├── models/             # Data models (MongoDB)
│       ├── Routes/             # API routes
│       ├── services/           # Business logic services
│       └── utilities/          # Helper functions
│
├── intelligence_engine/         # Core AI/ML recommendation engine
│   ├── main.py                 # Entry point
│   ├── models.py               # ML model definitions
│   ├── modules/                # Feature modules
│   │   ├── calibration.py      # Sensor calibration
│   │   ├── irrigation_recommender.py
│   │   ├── failure_detection.py
│   │   ├── water_analytics.py
│   │   └── zone_intelligence.py
│   └── data/                   # Configuration and data files
│
├── ml_models/                   # Pre-trained models
│   ├── test_irrigation_model.ipynb
│   ├── test_yield_model.ipynb
│   └── model_artifacts/
│
├── rag/                         # Retrieval-Augmented Generation
│   ├── rag_api.py              # RAG service API
│   ├── ndvi_processor.py       # NDVI data processing
│   ├── chroma_db/              # Vector database
│   └── rl_irrigation/          # Reinforcement learning module
│
├── soil_classifier/             # Soil classification service
│   ├── soil_service.py         # Service API
│   ├── soil_classification_model.h5
│   └── test_soil_model.ipynb
│
├── NewChatbot/                  # Conversational AI system
│   ├── chatbot.py              # Chatbot logic
│   ├── english.py              # English responses
│   ├── hindi.py                # Hindi responses
│   └── app.py                  # Chatbot app
│
├── scripts/                     # Utility scripts
│   ├── add-sensor-data.js
│   ├── migrate_models.py
│   └── test-chat.mjs
│
└── README.md                    # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16+) - For backend and frontend
- **Python** (v3.8+) - For intelligence engine and ML modules
- **MongoDB** - Database server
- **npm** or **yarn** - Package managers

### Installation

#### 1. Clone Repository
```bash
git clone https://github.com/pooravchoudhary8-cmyk/Agrosense.git
cd "Smart Irrigation System 333"
```

#### 2. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file in backend directory:
```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# JWT & Security
JWT_SECRET=your_jwt_secret_key

# Database
MONGO_URI=mongodb://localhost:27017/smart_irrigation

# API Configuration
NODE_ENV=development
PORT=5001
```

#### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

#### 4. Intelligence Engine Setup
```bash
cd ../intelligence_engine
pip install -r requirements.txt
```

#### 5. Additional Modules

**RAG System**:
```bash
cd ../rag
pip install -r requirements_rag_api.txt
```

**Chatbot**:
```bash
cd ../NewChatbot
pip install -r requirements.txt
```

**Soil Classifier**:
```bash
cd ../soil_classifier
pip install -r requirements.txt
```

---

## 🏃 Running the Application

### Start Backend Server
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:5001`

### Start Frontend Development Server
```bash
cd frontend
npm run dev
```
Application runs on `http://localhost:5173`

### Start Intelligence Engine
```bash
cd intelligence_engine
python main.py
```

### Start Chatbot Service
```bash
cd NewChatbot
python app.py
```

### Start RAG Service
```bash
cd rag
python rag_api.py
```

---

## ✨ Key Features

### 🌾 Core Features
- **Intelligent Irrigation Recommendations** - AI-powered watering schedules based on soil and environmental data
- **Zone-Based Management** - Manage multiple irrigation zones independently
- **Real-Time Anomaly Detection** - Detect unusual patterns in sensor data
- **Yield Prediction** - Estimate crop yield based on current conditions

### 🔐 Security & Authentication
- **Google OAuth2 Integration** - Social login with Google accounts
- **JWT-Based Sessions** - Secure token-based authentication
- **User Management** - User profiles and role-based access control

### 📊 Analytics & Insights
- **Water Usage Analytics** - Track water consumption patterns
- **Soil Analysis** - Deep learning-based soil classification and recommendations
- **Feature Engineering** - Automated feature extraction from sensor data
- **Calibration Profiles** - Sensor-specific calibration data management

### 🤖 AI/ML Capabilities
- **Reinforcement Learning** - Adaptive irrigation strategies using RL
- **RAG System** - Context-aware information retrieval and augmentation
- **Natural Language Processing** - Chatbot for farmer support in English/Hindi
- **Predictive Models** - Machine learning models for irrigation and yield prediction

### 🔗 IoT Integration
- **Sensor Data Integration** - Seamless integration with soil moisture, temperature sensors
- **Device Management** - Register and manage IoT devices
- **Real-Time Updates** - Live data streaming from field sensors

---

## 🔄 Workflow Overview

1. **Data Collection**: IoT sensors collect soil moisture, temperature, humidity, and other environmental data
2. **Data Processing**: Data is validated, calibrated, and processed by the intelligence engine
3. **Anomaly Detection**: System detects unusual patterns or sensor failures
4. **Feature Engineering**: Relevant features are extracted for ML models
5. **Recommendation Generation**: ML models generate irrigation recommendations
6. **User Interface**: Recommendations are displayed to farmers via web/mobile dashboard
7. **Execution**: Irrigation controllers execute recommendations
8. **Feedback Loop**: System learns from outcomes to improve future recommendations

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### ML Model Tests
```bash
# Irrigation Model
cd ml_models
jupyter notebook test_irrigation_model.ipynb

# Yield Model
jupyter notebook test_yield_model.ipynb

# Soil Classifier
cd ../soil_classifier
jupyter notebook test_soil_model.ipynb
```

### System Tests
```bash
python test_system.py
```

---

## 📋 API Documentation

### Authentication Endpoints
- `POST /api/auth/google` - Google OAuth initiation
- `GET /api/auth/google/callback` - OAuth callback handler
- `POST /api/auth/verify` - Verify JWT token

### Irrigation Endpoints
- `GET /api/irrigation/recommendations` - Get irrigation recommendations
- `POST /api/irrigation/zones` - Create irrigation zone
- `GET /api/irrigation/zones/:id` - Get zone details
- `PUT /api/irrigation/zones/:id` - Update zone configuration

### Sensor Data Endpoints
- `POST /api/sensors/data` - Submit sensor readings
- `GET /api/sensors` - List connected sensors
- `GET /api/sensors/:id/history` - Get sensor data history

---

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB service is running
- Verify `MONGO_URI` in `.env` file
- Check network connectivity

### Python Dependency Issues
```bash
# Clear cache and reinstall
pip cache purge
pip install -r requirements.txt --force-reinstall
```

### Frontend Build Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📈 Future Enhancements

- [ ] Mobile application (React Native)
- [ ] Advanced predictive models with climate data
- [ ] Multi-language support expansion
- [ ] Integration with weather APIs
- [ ] Blockchain-based audit trails
- [ ] Advanced visualization dashboards
- [ ] Edge computing for offline recommendations
- [ ] Integration with precision agriculture equipment

---

## 👨‍💻 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Google Cloud for OAuth and API services
- MongoDB for database solutions
- TensorFlow/PyTorch communities
- Open-source contributors and community feedback

---

## 📧 Contact & Support

For questions, issues, or suggestions, please:
- Open an issue on GitHub
- Contact the project maintainers
- Check the [Wiki](https://github.com/pooravchoudhary8-cmyk/Agrosense/wiki) for additional documentation

---

**Last Updated**: February 2026  
**Version**: 1.0.0
