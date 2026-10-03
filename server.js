const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      farm: {
        name: "Demo Farm",
        area: 2.5,
        roofArea: 180,
        tankCapacity: 20000,
        tankLevel: 14500,
        soilMoisture: 48,
        rainfallLast7Days: 12,
        rainfallForecast: 18,
        solarAvailable: 78,
        crop: "Tomato",
        growthStage: "Vegetative"
      },
      history: []
    };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Simple software-only AI decision engine.
// It does NOT read IoT sensors. All inputs come from the dashboard/API.
function analyze(farm) {
  const cropRates = {
    Tomato: 3200,
    Chilli: 2800,
    Paddy: 5200,
    Wheat: 2600,
    Maize: 3000,
    Groundnut: 2400,
    Sugarcane: 7000
  };

  const stageFactor = {
    Seedling: 0.65,
    Vegetative: 1.0,
    Flowering: 1.15,
    Fruiting: 1.2,
    Maturity: 0.8
  };

  const baseNeed = cropRates[farm.crop] || 3000;
  const dailyNeed = Math.round((baseNeed * (stageFactor[farm.growthStage] || 1)) / 30);

  const expectedRain = Number(farm.rainfallForecast) || 0;
  const soil = Number(farm.soilMoisture) || 0;
  const tank = Number(farm.tankLevel) || 0;
  const capacity = Number(farm.tankCapacity) || 1;
  const solar = Number(farm.solarAvailable) || 0;

  let irrigation = dailyNeed;

  if (expectedRain >= 12) irrigation = Math.round(irrigation * 0.25);
  else if (expectedRain >= 6) irrigation = Math.round(irrigation * 0.55);

  if (soil >= 70) irrigation = 0;
  else if (soil >= 55) irrigation = Math.round(irrigation * 0.5);

  irrigation = clamp(irrigation, 0, Math.min(dailyNeed, tank));

  const tankDays = dailyNeed > 0 ? Math.round((tank / dailyNeed) * 10) / 10 : 0;
  const waterBudget = Math.max(0, Math.round(tank - dailyNeed * 7));
  const droughtRisk =
    tankDays < 3 || (expectedRain < 5 && soil < 40)
      ? "High"
      : tankDays < 7
      ? "Medium"
      : "Low";

  let action = "No irrigation required";
  if (irrigation > 0) action = `Irrigate ${irrigation.toLocaleString()} L`;
  if (expectedRain >= 12) action += " after reviewing rainfall timing";

  const alerts = [];
  if (tank / capacity >= 0.9) alerts.push("Tank is nearly full. Check overflow/harvesting capacity.");
  if (tank / capacity <= 0.15) alerts.push("Low stored water. Reduce irrigation and prioritize critical crops.");
  if (soil < 30) alerts.push("Soil moisture is low. Consider controlled irrigation.");
  if (solar < 25) alerts.push("Low solar availability. Schedule pumping during better sunlight.");
  if (expectedRain >= 20) alerts.push("Heavy rainfall expected. Delay irrigation and maximize rainwater capture.");

  return {
    dailyNeed,
    recommendedIrrigation: irrigation,
    waterBudget7Days: waterBudget,
    tankDays,
    droughtRisk,
    action,
    alerts,
    explanation: [
      `Crop: ${farm.crop} (${farm.growthStage})`,
      `Estimated daily crop requirement: ${dailyNeed.toLocaleString()} L`,
      `Manual soil-moisture input: ${soil}%`,
      `Rainfall forecast input: ${expectedRain} mm`,
      `Available stored water: ${tank.toLocaleString()} L`,
      `Solar availability input: ${solar}%`
    ]
  };
}

app.get("/api/dashboard", (req, res) => {
  const data = readData();
  const ai = analyze(data.farm);
  res.json({ farm: data.farm, ai, history: data.history.slice(-12).reverse() });
});

app.post("/api/farm", (req, res) => {
  const data = readData();
  const allowed = [
    "name", "area", "roofArea", "tankCapacity", "tankLevel",
    "soilMoisture", "rainfallLast7Days", "rainfallForecast",
    "solarAvailable", "crop", "growthStage"
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) data.farm[key] = req.body[key];
  }

  data.farm.area = Number(data.farm.area);
  data.farm.roofArea = Number(data.farm.roofArea);
  data.farm.tankCapacity = Number(data.farm.tankCapacity);
  data.farm.tankLevel = clamp(Number(data.farm.tankLevel), 0, data.farm.tankCapacity);
  data.farm.soilMoisture = clamp(Number(data.farm.soilMoisture), 0, 100);
  data.farm.rainfallLast7Days = Math.max(0, Number(data.farm.rainfallLast7Days));
  data.farm.rainfallForecast = Math.max(0, Number(data.farm.rainfallForecast));
  data.farm.solarAvailable = clamp(Number(data.farm.solarAvailable), 0, 100);

  const ai = analyze(data.farm);
  data.history.push({
    date: new Date().toISOString(),
    tankLevel: data.farm.tankLevel,
    soilMoisture: data.farm.soilMoisture,
    rainfallForecast: data.farm.rainfallForecast,
    recommendedIrrigation: ai.recommendedIrrigation
  });
  saveData(data);

  res.json({ farm: data.farm, ai });
});

app.post("/api/simulate-rain", (req, res) => {
  const data = readData();
  const mm = Math.max(0, Number(req.body.mm) || 0);

  // Approximate harvested water:
  // volume(L) = rainfall(mm) × roof area(m²) × runoff coefficient × 1 L/mm/m²
  const runoffCoefficient = 0.8;
  const harvested = Math.round(mm * data.farm.roofArea * runoffCoefficient);
  data.farm.tankLevel = clamp(
    data.farm.tankLevel + harvested,
    0,
    data.farm.tankCapacity
  );
  data.farm.rainfallLast7Days += mm;

  saveData(data);
  res.json({
    rainfall: mm,
    harvestedLitres: harvested,
    tankLevel: data.farm.tankLevel,
    ai: analyze(data.farm)
  });
});

app.post("/api/irrigate", (req, res) => {
  const data = readData();
  const amount = Math.max(0, Number(req.body.amount) || analyze(data.farm).recommendedIrrigation);

  if (amount > data.farm.tankLevel) {
    return res.status(400).json({ error: "Not enough water in the tank." });
  }

  data.farm.tankLevel -= amount;
  data.history.push({
    date: new Date().toISOString(),
    tankLevel: data.farm.tankLevel,
    soilMoisture: data.farm.soilMoisture,
    rainfallForecast: data.farm.rainfallForecast,
    irrigationUsed: amount
  });
  saveData(data);

  res.json({ amount, tankLevel: data.farm.tankLevel, ai: analyze(data.farm) });
});

app.post("/api/reset", (req, res) => {
  const fresh = {
    farm: {
      name: "Demo Farm",
      area: 2.5,
      roofArea: 180,
      tankCapacity: 20000,
      tankLevel: 14500,
      soilMoisture: 48,
      rainfallLast7Days: 12,
      rainfallForecast: 18,
      solarAvailable: 78,
      crop: "Tomato",
      growthStage: "Vegetative"
    },
    history: []
  };
  saveData(fresh);
  res.json({ message: "Demo data reset." });
});

app.listen(PORT, () => {
  console.log(`AquaSage AI running at http://localhost:${PORT}`);
});