# AquaSage AI — No IoT Version

A software-only prototype for smart rainwater harvesting, water budgeting and irrigation decision support.

## Main idea

This version intentionally removes:
- ESP32
- physical IoT sensors
- MQTT
- GSM/Wi-Fi hardware
- physical relay/pump control
- electrical hardware integration

Instead, farmers or an administrator enter the values manually, and the software AI engine analyzes them.

## Features

- Farm dashboard
- Tank water monitoring
- Manual soil-moisture input
- Manual rainfall forecast input
- Solar availability input
- Crop and growth-stage selection
- AI-style irrigation recommendation
- 7-day water budget
- Drought-risk estimation
- Rainwater harvesting simulator
- Virtual irrigation simulator
- Alerts and recommendations
- Historical analytics
- JSON-based local data storage
- Responsive web interface

## Requirements

- Node.js 18+ recommended
- npm

## Run

```bash
npm install
npm start
```

Open:

http://localhost:5000

## AI logic

The current AI engine is an explainable rule-based decision-support model. It combines:
- crop type
- crop growth stage
- estimated daily water demand
- current tank level
- soil moisture
- rainfall forecast
- solar availability

For a hackathon, this can later be upgraded to a trained ML model using historical crop/weather/water-consumption datasets.

## Important

The rainwater calculation is an approximate simulation:

harvested water (L) = rainfall (mm) × roof area (m²) × runoff coefficient

The prototype uses a runoff coefficient of 0.8.

This is a software prototype and should not directly control real pumps or electrical equipment without proper engineering, electrical protection and field validation.
