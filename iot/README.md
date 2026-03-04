# IoT Module — Smart Irrigation System

This directory is the home for all IoT/embedded firmware and configuration files.

## Contents (add as needed)

- **ESP32 Arduino sketches** (.ino) — sensor reading, MQTT publishing, pump control
- **Pin configuration** — GPIO mappings for soil sensors, DHT11/22, rain sensor, relay
- **MQTT topic reference** — `farm/sensorData`, `farm/pumpControl`
- **Wiring diagrams** — circuit schematics (Fritzing, KiCad, or PNG)

## Hardware

- ESP32 DevKit V1
- 2× Capacitive Soil Moisture Sensors
- DHT22 Temperature/Humidity Sensor
- Rain Sensor Module
- 5V Relay Module (pump control)

## MQTT Broker

Default: `mqtt://test.mosquitto.org:1883`
Topics configured in root `.env` file.
