let state = null;

const $ = (id) => document.getElementById(id);
const litres = (n) => `${Number(n || 0).toLocaleString()} L`;

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function refresh() {
  try {
    state = await api("/api/dashboard");
    render();
  } catch (e) {
    alert(e.message);
  }
}

function render() {
  const f = state.farm;
  const a = state.ai;

  $("tank").textContent = litres(f.tankLevel);
  $("tankPct").textContent = `${Math.round((f.tankLevel / f.tankCapacity) * 100)}% of capacity`;
  $("soil").textContent = `${f.soilMoisture}%`;
  $("rain").textContent = `${f.rainfallForecast} mm`;
  $("solar").textContent = `${f.solarAvailable}%`;

  $("decision").textContent = a.action;
  $("dailyNeed").textContent = litres(a.dailyNeed);
  $("recommend").textContent = litres(a.recommendedIrrigation);
  $("budget7").textContent = litres(a.waterBudget7Days);
  $("tankDays").textContent = `${a.tankDays} days`;
  $("risk").textContent = a.droughtRisk;

  $("alerts").innerHTML = a.alerts.length
    ? a.alerts.map(x => `<div class="alert">⚠️ ${escapeHtml(x)}</div>`).join("")
    : `<div class="alert ok">✅ No major alerts from the current inputs.</div>`;

  $("explanation").innerHTML = a.explanation
    .map(x => `<div>${escapeHtml(x)}</div>`).join("");

  $("budgetCrop").textContent = f.crop;
  $("budgetDaily").textContent = litres(a.dailyNeed);
  $("budgetReserve").textContent = litres(a.waterBudget7Days);
  $("budgetDays").textContent = `${a.tankDays} days`;
  $("irrigationAction").textContent = a.action;
  $("irrigationAmount").value = a.recommendedIrrigation;

  const history = state.history || [];
  $("history").innerHTML = history.length
    ? history.map(h => `<tr>
        <td>${new Date(h.date).toLocaleString()}</td>
        <td>${Number(h.tankLevel || 0).toLocaleString()}</td>
        <td>${h.soilMoisture ?? "--"}</td>
        <td>${h.rainfallForecast ?? "--"}</td>
        <td>${h.irrigationUsed ?? h.recommendedIrrigation ?? "--"}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">No records yet. Update farm data or simulate an action.</td></tr>`;

  fillForm(f);
}

function fillForm(f) {
  const form = $("farmForm");
  Object.keys(f).forEach(k => {
    if (form.elements[k]) form.elements[k].value = f[k];
  });
}

$("farmForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  for (const k of ["area","roofArea","tankCapacity","tankLevel","soilMoisture","rainfallLast7Days","rainfallForecast","solarAvailable"]) {
    data[k] = Number(data[k]);
  }

  try {
    await api("/api/farm", { method: "POST", body: JSON.stringify(data) });
    await refresh();
    alert("Farm data saved and AI analysis updated.");
  } catch (err) {
    alert(err.message);
  }
});

async function runIrrigation() {
  try {
    const amount = Number($("irrigationAmount").value);
    const result = await api("/api/irrigate", {
      method: "POST",
      body: JSON.stringify({ amount })
    });
    $("irrigationMessage").innerHTML = `<div class="alert ok">✅ Virtual irrigation used ${result.amount.toLocaleString()} L. Remaining tank: ${result.tankLevel.toLocaleString()} L.</div>`;
    await refresh();
  } catch (e) {
    $("irrigationMessage").innerHTML = `<div class="alert">❌ ${escapeHtml(e.message)}</div>`;
  }
}

async function simulateRain() {
  try {
    const mm = Number($("rainAmount").value);
    const result = await api("/api/simulate-rain", {
      method: "POST",
      body: JSON.stringify({ mm })
    });
    $("rainMessage").innerHTML = `<div class="alert ok">🌧️ ${mm} mm rainfall added. Approx. ${result.harvestedLitres.toLocaleString()} L harvested. Tank: ${result.tankLevel.toLocaleString()} L.</div>`;
    await refresh();
  } catch (e) {
    $("rainMessage").innerHTML = `<div class="alert">❌ ${escapeHtml(e.message)}</div>`;
  }
}

async function resetDemo() {
  if (!confirm("Reset all demo data?")) return;
  await api("/api/reset", { method: "POST" });
  await refresh();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.target).classList.add("active");
  });
});

refresh();