const OWNER_WHATSAPP = "244963201382"; // Troca pelo teu número. Ex: 244921744420

const LUANDA_CENTER = { lat: -8.839, lng: 13.2894, zoom: 12 };
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const APPS = [
  {
    id: "yango",
    name: "Yango",
    type: "Economy",
    etaBase: 6,
    min: 850,
    perKm: 310,
    availability: 0.98,
    logo: "assets/yango.png",
    url: "https://yango.com/"
  },
  {
    id: "heetch",
    name: "Heetch",
    type: "Standard",
    etaBase: 8,
    min: 900,
    perKm: 340,
    availability: 0.78,
    logo: "assets/heetch.png",
    url: "https://www.heetch.com/"
  },
  {
    id: "kubinga",
    name: "Kubinga",
    type: "Local",
    etaBase: 10,
    min: 800,
    perKm: 330,
    availability: 0.62,
    logo: "assets/kubinga.png",
    url: "https://www.google.com/search?q=Kubinga+Angola"
  },
  {
    id: "tleva",
    name: "T'Leva",
    type: "Local",
    etaBase: 11,
    min: 750,
    perKm: 350,
    availability: 0.56,
    logo: "assets/t'leva.png",
    url: "https://www.google.com/search?q=T%27Leva+Angola"
  },
  {
    id: "indrive",
    name: "inDrive",
    type: "Negociável",
    etaBase: 9,
    min: 650,
    perKm: 290,
    availability: 0.7,
    logo: "assets/indrive.png",
    url: "https://indrive.com/"
  }
];

const TIME_MULTIPLIERS = {
  agora: 1,
  manha: 1.08,
  pico: 1.28,
  noite: 1.18
};

const fieldLocations = {
  pickupInput: null,
  destinationInput: null
};

let liveTimeBucket = getCurrentTimeBucket();
let currentRoute = {
  pickup: "",
  destination: "",
  time: liveTimeBucket,
  distance: 0,
  pickupLocation: null,
  destinationLocation: null
};
let currentResults = [];
let selectedRide = null;
let currentSort = "price";
let backgroundMap = null;
let backgroundRouteLine = null;
let backgroundRouteMarkers = [];
let pickerMap = null;
let pickerMarker = null;
let activeMapFieldId = null;
let pendingMapLocation = null;
let mapSelectionToken = 0;

const geocodeCache = new Map();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function initLoadingScreen() {
  const loadingScreen = $("#loadingScreen");
  if (!loadingScreen) return;

  const startedAt = performance.now();
  const minVisibleMs = 1150;
  const fallbackMs = 2800;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;

    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    window.setTimeout(() => {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
      loadingScreen.setAttribute("aria-hidden", "true");
    }, remaining);
  };

  if (document.readyState === "complete") {
    finish();
  } else {
    window.addEventListener("load", finish, { once: true });
  }

  window.setTimeout(finish, fallbackMs);
}

function formatKz(value) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0
  }).format(Math.round(value)).replace("AOA", "Kz");
}

function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) return "-- km";

  return `${distance.toLocaleString("pt-AO", {
    maximumFractionDigits: 1,
    minimumFractionDigits: distance < 10 ? 1 : 0
  })} km`;
}

function getSortedResults(results = currentResults) {
  const data = [...results];
  if (currentSort === "eta") {
    return data.sort((a, b) => a.eta - b.eta || a.estimate - b.estimate);
  }
  return data.sort((a, b) => a.estimate - b.estimate || a.eta - b.eta);
}

function updateSortToggle() {
  $$("[data-sort]").forEach(btn => {
    const isActive = btn.dataset.sort === currentSort;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function normalizePrice(value) {
  const n = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function getCurrentTimeBucket(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 6 && hour < 11) return "manha";
  if (hour >= 16 && hour < 20) return "pico";
  if (hour >= 20 || hour < 5) return "noite";
  return "agora";
}

function labelTime(value) {
  return {
    agora: "agora",
    manha: "manhã",
    pico: "hora de pico",
    noite: "noite"
  }[value] || "agora";
}

function updateCurrentTimeDisplay() {
  const now = new Date();
  liveTimeBucket = getCurrentTimeBucket(now);

  const timeDisplay = $("#currentTimeDisplay");
  const bucketDisplay = $("#timeBucketDisplay");

  if (timeDisplay) {
    timeDisplay.textContent = now.toLocaleTimeString("pt-AO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  if (bucketDisplay) {
    bucketDisplay.textContent = labelTime(liveTimeBucket);
  }
}

function initMapBackground() {
  const canvas = $("#appMap");
  if (!canvas || !window.L || backgroundMap) return;

  backgroundMap = window.L.map(canvas, {
    zoomControl: true,
    attributionControl: false,
    dragging: true,
    touchZoom: true,
    doubleClickZoom: true,
    scrollWheelZoom: true,
    boxZoom: true,
    keyboard: true,
    tap: true
  }).setView([LUANDA_CENTER.lat, LUANDA_CENTER.lng], LUANDA_CENTER.zoom);

  backgroundMap.zoomControl.setPosition("bottomright");

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(backgroundMap);

  document.body.classList.add("leaflet-map-ready");
  window.setTimeout(() => {
    backgroundMap.invalidateSize();
    updateRouteMap(currentRoute);
  }, 80);
}

function clearBackgroundRoute() {
  backgroundRouteMarkers.forEach(marker => marker.remove());
  backgroundRouteMarkers = [];

  if (backgroundRouteLine) {
    backgroundRouteLine.remove();
    backgroundRouteLine = null;
  }
}

function createRouteMarker(point, index) {
  return window.L.circleMarker([point.lat, point.lng], {
    radius: index === 0 ? 7 : 8,
    color: "#ffffff",
    weight: 3,
    fillColor: index === 0 ? "#071a2f" : "#0f62fe",
    fillOpacity: 1,
    interactive: false
  });
}

function updateRouteMap(route = currentRoute) {
  if (!backgroundMap || !window.L) return;

  clearBackgroundRoute();

  const pickup = route.pickupLocation || fieldLocations.pickupInput;
  const destination = route.destinationLocation || fieldLocations.destinationInput;
  const points = [pickup, destination].filter(isValidLocation);

  if (!points.length) {
    backgroundMap.setView([LUANDA_CENTER.lat, LUANDA_CENTER.lng], LUANDA_CENTER.zoom);
    return;
  }

  points.forEach((point, index) => {
    const marker = createRouteMarker(point, index).addTo(backgroundMap);
    backgroundRouteMarkers.push(marker);
  });

  if (isValidLocation(pickup) && isValidLocation(destination)) {
    const routePoints = [
      [pickup.lat, pickup.lng],
      [destination.lat, destination.lng]
    ];

    backgroundRouteLine = window.L.polyline(routePoints, {
      color: "#071a2f",
      opacity: .82,
      weight: 4,
      interactive: false
    }).addTo(backgroundMap);

    backgroundMap.fitBounds(window.L.latLngBounds(routePoints), {
      padding: [96, 96],
      maxZoom: 15,
      animate: true,
      duration: .25
    });
  } else {
    backgroundMap.setView([points[0].lat, points[0].lng], 14);
  }
}

function showView(viewId) {
  $$(".view").forEach(view => view.classList.remove("active"));
  const view = document.getElementById(viewId);
  if (view) view.classList.add("active");

  $$(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });

  if (viewId === "historyView") renderHistory();
  if (viewId === "settingsView") showSettingsPanel("main");
}

function showSettingsPanel(panel) {
  const showHelp = panel === "help";
  $("#settingsMainPanel")?.classList.toggle("active", !showHelp);
  $("#settingsHelpPanel")?.classList.toggle("active", showHelp);
  $("#settingsHelpPanel")?.setAttribute("aria-hidden", String(!showHelp));
}

function estimateRides(route) {
  const saved = getContributions();
  const routeKey = makeRouteKey(route.pickup, route.destination);
  const distance = Number(route.distance) || 0;
  const timeMultiplier = TIME_MULTIPLIERS[route.time] || 1;

  return APPS.map((app, index) => {
    const relevant = saved.filter(item => item.routeKey === routeKey && item.app === app.name);
    const communityAvg = relevant.length
      ? relevant.reduce((sum, item) => sum + item.price, 0) / relevant.length
      : null;

    const deterministicNoise = ((route.pickup.length + route.destination.length + index * 7) % 9) / 100;
    const base = (app.min + distance * app.perKm) * timeMultiplier;
    const estimate = communityAvg ? (communityAvg * 0.65 + base * 0.35) : base * (1 + deterministicNoise);

    return {
      ...app,
      estimate,
      minRange: estimate * 0.92,
      maxRange: estimate * 1.13,
      eta: Math.max(2, Math.round(app.etaBase + distance * 0.35 + index - app.availability * 2)),
      contributions: relevant.length
    };
  }).sort((a, b) => a.estimate - b.estimate);
}

function renderResults() {
  $("#summaryPickup").textContent = currentRoute.pickup;
  $("#summaryDestination").textContent = currentRoute.destination;
  $("#summaryRoute").textContent = `${currentRoute.pickup} → ${currentRoute.destination}`;
  $("#resultsMeta").textContent = `${formatDistance(currentRoute.distance)} · ${labelTime(currentRoute.time)} · estimativa beta`;
  updateSortToggle();

  const list = $("#rideList");
  list.innerHTML = "";

  getSortedResults().forEach((ride, i) => {
    const bestLabel = currentSort === "eta" ? "Mais próximo" : "Melhor preço";
    const card = document.createElement("article");
    card.className = `ride-card ${i === 0 ? "best" : ""}`;
    card.innerHTML = `
      <img class="ride-logo" src="${escapeHtml(ride.logo)}" alt="" aria-hidden="true" loading="lazy">
      <div class="ride-main">
        <div class="ride-title">
          <strong>${formatKz(ride.estimate)}</strong>
          ${i === 0 ? `<span class="badge">${bestLabel}</span>` : ""}
        </div>
        <div class="ride-sub">${ride.name} · ${ride.type} · motorista chega em ${ride.eta} min · ${ride.contributions} contribuições</div>
      </div>
      <div class="ride-price">
        <strong>${ride.eta} min</strong>
        <span>${formatKz(ride.minRange)} a ${formatKz(ride.maxRange)}</span>
      </div>
    `;
    card.addEventListener("click", () => selectRide(ride));
    list.appendChild(card);
  });
}

function compareRoute(route) {
  currentRoute = {
    ...route,
    searchedAt: new Date().toISOString()
  };
  currentResults = estimateRides(currentRoute);
  renderResults();
  addSearchHistory(currentRoute);
  updateRouteMap(currentRoute);
  showView("resultsView");
}

function selectRide(ride) {
  selectedRide = ride;
  $("#selectedApp").textContent = ride.name;
  $("#selectedPrice").textContent = formatKz(ride.estimate);
  $("#redirectTitle").textContent = `Abrir ${ride.name}`;
  $("#openExternalLink").href = ride.url;
  showView("redirectView");
}

function makeRouteKey(pickup, destination) {
  return `${pickup.trim().toLowerCase()}__${destination.trim().toLowerCase()}`;
}

function getContributions() {
  try {
    return JSON.parse(localStorage.getItem("tarifaao_contributions") || "[]");
  } catch {
    return [];
  }
}

function saveContribution(item) {
  const data = getContributions();
  data.unshift(item);
  localStorage.setItem("tarifaao_contributions", JSON.stringify(data.slice(0, 200)));
}

function addSearchHistory(route) {
  const data = getHistory();
  data.unshift({ ...route, createdAt: new Date().toISOString() });
  localStorage.setItem("tarifaao_history", JSON.stringify(data.slice(0, 30)));
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("tarifaao_history") || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const list = $("#historyList");
  const history = getHistory();

  if (!history.length) {
    list.innerHTML = `<div class="history-item">Ainda não há pesquisas neste dispositivo.</div>`;
    return;
  }

  list.innerHTML = history.map(item => `
    <div class="history-item">
      <strong>${escapeHtml(item.pickup)} → ${escapeHtml(item.destination)}</strong><br>
      <small>${labelTime(item.time)} · ${formatDistance(item.distance)} · ${new Date(item.createdAt).toLocaleString("pt-AO")}</small>
    </div>
  `).join("");
}

function openContributeDialog() {
  $("#contribApp").value = selectedRide?.name || currentResults[0]?.name || "Yango";
  $("#contributeDialog").showModal();
}

function buildContribution() {
  const app = $("#contribApp").value;
  const price = normalizePrice($("#contribPrice").value);
  const eta = $("#contribEta").value.trim();
  const note = $("#contribNote").value.trim();
  const pickup = currentRoute.pickup || $("#pickupInput").value.trim();
  const destination = currentRoute.destination || $("#destinationInput").value.trim();
  const distance = Number(currentRoute.distance || calculateFieldDistance() || 0);
  const time = currentRoute.time || liveTimeBucket;

  if (!price) {
    alert("Coloca um preço válido. Não vamos treinar o algoritmo com poesia.");
    return null;
  }

  return {
    app,
    price,
    eta,
    note,
    pickup,
    destination,
    time,
    distance,
    routeKey: makeRouteKey(pickup, destination),
    createdAt: new Date().toISOString()
  };
}

function sendContributionWhatsApp(item) {
  const msg = [
    "Nova contribuição Tarifa.ao",
    `App: ${item.app}`,
    `Origem: ${item.pickup}`,
    `Destino: ${item.destination}`,
    `Preço: ${formatKz(item.price)}`,
    `ETA: ${item.eta || "não informado"}`,
    `Hora: ${labelTime(item.time)}`,
    `Distância calculada: ${formatDistance(item.distance)}`,
    `Nota: ${item.note || "sem nota"}`
  ].join("\n");

  const url = `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener");
}

function resetContributionForm() {
  $("#contribPrice").value = "";
  $("#contribEta").value = "";
  $("#contribNote").value = "";
}

function isValidLocation(location) {
  return Boolean(
    location &&
    Number.isFinite(Number(location.lat)) &&
    Number.isFinite(Number(location.lng))
  );
}

function toLocation(label, lat, lng) {
  const numericLat = Number(lat);
  const numericLng = Number(lng);

  return {
    label: label || formatFallbackAddress(numericLat, numericLng),
    lat: numericLat,
    lng: numericLng
  };
}

function setFieldLocation(fieldId, location, options = {}) {
  if (!isValidLocation(location)) return null;

  const input = document.getElementById(fieldId);
  const normalized = toLocation(location.label, location.lat, location.lng);
  fieldLocations[fieldId] = normalized;

  if (input && options.updateValue !== false) {
    input.value = normalized.label;
  }

  if (input) {
    if (options.autofill) {
      input.dataset.autofilledLocation = "true";
    } else {
      delete input.dataset.autofilledLocation;
    }
    updateMapOption(input);
  }

  updateDistanceDisplay();
  updateRouteMap();
  return normalized;
}

function clearFieldLocation(fieldId) {
  fieldLocations[fieldId] = null;
  updateDistanceDisplay();
  updateRouteMap();
}

function calculateDistanceKm(pointA, pointB) {
  if (!isValidLocation(pointA) || !isValidLocation(pointB)) return null;

  const toRad = (value) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(Number(pointB.lat) - Number(pointA.lat));
  const dLng = toRad(Number(pointB.lng) - Number(pointA.lng));
  const lat1 = toRad(Number(pointA.lat));
  const lat2 = toRad(Number(pointB.lat));

  const haversine = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const distance = earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.max(0.1, Math.round(distance * 10) / 10);
}

function calculateFieldDistance() {
  return calculateDistanceKm(fieldLocations.pickupInput, fieldLocations.destinationInput);
}

function updateDistanceDisplay() {
  const display = $("#distanceDisplay");
  if (!display) return;
  display.textContent = formatDistance(calculateFieldDistance());
}

function formatFallbackAddress(lat, lng) {
  return `Lat ${Number(lat).toFixed(5)}, Long ${Number(lng).toFixed(5)}`;
}

function shortenDisplayName(displayName) {
  return String(displayName || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
}

function uniqueParts(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    const clean = String(part || "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatNominatimAddress(item) {
  const address = item?.address || {};
  const primary = item?.name ||
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    address.city_district ||
    address.town ||
    address.city ||
    address.village;

  const pieces = uniqueParts([
    primary,
    address.neighbourhood,
    address.suburb,
    address.city || address.town || address.county || address.state,
    address.country
  ]);

  return pieces.slice(0, 4).join(", ") || shortenDisplayName(item?.display_name);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Pedido falhou com estado ${response.status}`);
  }

  return response.json();
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
  const data = await fetchJson(url);
  return toLocation(formatNominatimAddress(data) || formatFallbackAddress(lat, lng), lat, lng);
}

async function geocodeAddress(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const cacheKey = cleanQuery.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&countrycodes=ao&addressdetails=1&q=${encodeURIComponent(cleanQuery)}`;
  const data = await fetchJson(url);
  const match = Array.isArray(data) ? data[0] : null;
  const location = match
    ? toLocation(formatNominatimAddress(match) || cleanQuery, match.lat, match.lon)
    : null;

  geocodeCache.set(cacheKey, location);
  return location;
}

async function resolveLocationFromInput(fieldId) {
  const input = document.getElementById(fieldId);
  const typedValue = input?.value.trim();
  if (!input || !typedValue) return null;

  const storedLocation = fieldLocations[fieldId];
  if (isValidLocation(storedLocation) && storedLocation.label === typedValue) {
    return storedLocation;
  }

  const location = await geocodeAddress(typedValue);
  if (!location) return null;
  return setFieldLocation(fieldId, location);
}

function updateMapOption(input) {
  const wrap = input?.closest(".location-input-wrap");
  if (!wrap) return;

  const button = wrap.querySelector(".map-option");
  const shouldShow = document.activeElement === input && input.value.trim().length > 0;

  wrap.classList.toggle("has-map-option", shouldShow);

  if (button) {
    button.tabIndex = shouldShow ? 0 : -1;
    button.setAttribute("aria-hidden", String(!shouldShow));
  }
}

function initLocationField(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;

  input.addEventListener("input", () => {
    delete input.dataset.autofilledLocation;
    clearFieldLocation(fieldId);
    updateMapOption(input);
  });

  input.addEventListener("focus", () => updateMapOption(input));
  input.addEventListener("blur", () => {
    window.setTimeout(() => updateMapOption(input), 140);
  });
}

function getMapCenterForField(fieldId) {
  const current = fieldLocations[fieldId];
  if (isValidLocation(current)) return { ...current, zoom: 15 };

  const pickup = fieldLocations.pickupInput;
  if (isValidLocation(pickup)) return { ...pickup, zoom: 14 };

  return LUANDA_CENTER;
}

function setPickerMarker(location) {
  if (!isValidLocation(location)) return;

  if (!pickerMap || !window.L) return;

  if (!pickerMarker) {
    pickerMarker = window.L.marker([location.lat, location.lng]).addTo(pickerMap);
  } else {
    pickerMarker.setLatLng([location.lat, location.lng]);
  }
}

function initPickerMap(center) {
  const canvas = $("#mapCanvas");
  canvas.classList.remove("unavailable");
  canvas.textContent = "";

  if (!window.L) {
    canvas.classList.add("unavailable");
    canvas.textContent = "Mapa indisponível. Confirma a ligação à internet e tenta novamente.";
    return;
  }

  if (!pickerMap) {
    pickerMap = window.L.map(canvas).setView([center.lat, center.lng], center.zoom || 13);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(pickerMap);
    pickerMap.on("click", (event) => selectMapPoint(event.latlng.lat, event.latlng.lng));
  } else {
    pickerMap.setView([center.lat, center.lng], center.zoom || 13);
  }

  if (pickerMarker) {
    pickerMap.removeLayer(pickerMarker);
    pickerMarker = null;
  }

  const existing = fieldLocations[activeMapFieldId];
  if (isValidLocation(existing)) setPickerMarker(existing);

  window.setTimeout(() => pickerMap.invalidateSize(), 80);
}

async function selectMapPoint(lat, lng) {
  if (!activeMapFieldId) return;

  const token = ++mapSelectionToken;
  const fallbackLocation = toLocation(formatFallbackAddress(lat, lng), lat, lng);

  pendingMapLocation = fallbackLocation;
  setPickerMarker(fallbackLocation);
  setFieldLocation(activeMapFieldId, fallbackLocation);
  $("#mapSelectedAddress").textContent = "A obter endereço...";
  $("#confirmMapLocation").disabled = false;

  try {
    const resolvedLocation = await reverseGeocode(lat, lng);
    if (token !== mapSelectionToken) return;
    pendingMapLocation = resolvedLocation;
    setFieldLocation(activeMapFieldId, resolvedLocation);
    $("#mapSelectedAddress").textContent = resolvedLocation.label;
  } catch {
    if (token !== mapSelectionToken) return;
    $("#mapSelectedAddress").textContent = fallbackLocation.label;
  }
}

async function openMapPicker(fieldId) {
  activeMapFieldId = fieldId;
  pendingMapLocation = fieldLocations[fieldId];

  const isPickup = fieldId === "pickupInput";
  $("#mapDialogTitle").textContent = isPickup ? "Definir origem no mapa" : "Definir destino no mapa";
  $("#mapSelectedAddress").textContent = pendingMapLocation?.label || "Escolhe um ponto no mapa";
  $("#confirmMapLocation").disabled = !isValidLocation(pendingMapLocation);
  $("#mapDialog").showModal();

  const center = getMapCenterForField(fieldId);
  window.setTimeout(() => initPickerMap(center), 40);

  const inputValue = document.getElementById(fieldId)?.value.trim();
  if (!isValidLocation(pendingMapLocation) && inputValue) {
    try {
      const location = await geocodeAddress(inputValue);
      if (!location || activeMapFieldId !== fieldId) return;
      if (pickerMap) {
        pickerMap.setView([location.lat, location.lng], 15);
      }
    } catch {
      // Mantém o mapa no centro padrão se a busca pelo texto falhar.
    }
  }
}

function closeMapPicker() {
  $("#mapDialog").close();
  activeMapFieldId = null;
  pendingMapLocation = null;
}

function requestCurrentLocation(options = {}) {
  const input = $("#pickupInput");
  const placeholder = input.placeholder;

  if (!navigator.geolocation || !input) return;
  if (!options.force && input.value.trim() && input.dataset.autofilledLocation !== "true") return;

  input.placeholder = "A detectar localização actual...";

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    const fallbackLocation = toLocation(formatFallbackAddress(latitude, longitude), latitude, longitude);

    if (!options.force && input.value.trim() && input.dataset.autofilledLocation !== "true") {
      input.placeholder = placeholder;
      return;
    }

    setFieldLocation("pickupInput", fallbackLocation, { autofill: true });

    try {
      const resolvedLocation = await reverseGeocode(latitude, longitude);
      if (!options.force && input.value.trim() && input.dataset.autofilledLocation !== "true") return;
      setFieldLocation("pickupInput", resolvedLocation, { autofill: true });
    } catch {
      // As coordenadas já ficam como fallback quando o endereço não é resolvido.
    } finally {
      input.placeholder = placeholder;
    }
  }, () => {
    const shouldClearInput = !input.value.trim() || input.dataset.autofilledLocation === "true";

    clearFieldLocation("pickupInput");
    if (shouldClearInput) input.value = "";
    input.placeholder = placeholder;
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000
  });
}

function setQuickRoute(btn) {
  const pickupLocation = toLocation(
    btn.dataset.pickup,
    btn.dataset.pickupLat,
    btn.dataset.pickupLng
  );
  const destinationLocation = toLocation(
    btn.dataset.destination,
    btn.dataset.destinationLat,
    btn.dataset.destinationLng
  );
  const distance = calculateDistanceKm(pickupLocation, destinationLocation);

  setFieldLocation("pickupInput", pickupLocation);
  setFieldLocation("destinationInput", destinationLocation);

  compareRoute({
    pickup: pickupLocation.label,
    destination: destinationLocation.label,
    time: liveTimeBucket,
    distance,
    pickupLocation,
    destinationLocation
  });
}

async function submitRouteForm(event) {
  event.preventDefault();

  const pickup = $("#pickupInput").value.trim();
  const destination = $("#destinationInput").value.trim();
  const submitButton = $("#routeForm .primary-btn");
  const defaultButtonText = submitButton.textContent;

  if (!pickup || !destination) return;

  submitButton.disabled = true;
  submitButton.textContent = "A calcular...";

  try {
    const pickupLocation = await resolveLocationFromInput("pickupInput");
    const destinationLocation = await resolveLocationFromInput("destinationInput");
    const distance = calculateDistanceKm(pickupLocation, destinationLocation);

    if (!distance) {
      alert("Não consegui calcular a distância desta rota. Define a origem e o destino no mapa.");
      return;
    }

    updateDistanceDisplay();

    compareRoute({
      pickup: $("#pickupInput").value.trim(),
      destination: $("#destinationInput").value.trim(),
      time: liveTimeBucket,
      distance,
      pickupLocation,
      destinationLocation
    });
  } catch {
    alert("Não consegui calcular a distância desta rota. Define a origem e o destino no mapa.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = defaultButtonText;
  }
}

function initEvents() {
  initLocationField("pickupInput");
  initLocationField("destinationInput");

  $("#routeForm").addEventListener("submit", submitRouteForm);

  $$(".map-option").forEach(btn => {
    btn.tabIndex = -1;
    btn.setAttribute("aria-hidden", "true");
    btn.addEventListener("click", () => openMapPicker(btn.dataset.mapTarget));
  });

  $$(".quick-route").forEach(btn => {
    btn.addEventListener("click", () => setQuickRoute(btn));
  });

  $$(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  $$("[data-sort]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentSort = btn.dataset.sort || "price";
      renderResults();
    });
  });

  $("#backToHome").addEventListener("click", () => showView("homeView"));
  $("#backToResults").addEventListener("click", () => showView("resultsView"));
  $("#cancelRedirect").addEventListener("click", () => showView("resultsView"));

  $("#openContributeBottom").addEventListener("click", openContributeDialog);
  $("#closeContribute").addEventListener("click", () => $("#contributeDialog").close());
  $("#openPrivacy").addEventListener("click", () => $("#privacyDialog").showModal());
  $("#closePrivacy").addEventListener("click", () => $("#privacyDialog").close());
  $("#openTerms").addEventListener("click", () => $("#termsDialog").showModal());
  $("#closeTerms").addEventListener("click", () => $("#termsDialog").close());
  $("#closeMapDialog").addEventListener("click", closeMapPicker);
  $("#confirmMapLocation").addEventListener("click", closeMapPicker);

  $("#contributeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const item = buildContribution();
    if (!item) return;

    saveContribution(item);
    sendContributionWhatsApp(item);
    resetContributionForm();
    $("#contributeDialog").close();

    if (currentRoute.pickup && currentRoute.destination) {
      currentResults = estimateRides(currentRoute);
      renderResults();
    }
  });

  $("#saveLocalOnly").addEventListener("click", () => {
    const item = buildContribution();
    if (!item) return;

    saveContribution(item);
    resetContributionForm();
    $("#contributeDialog").close();

    if (currentRoute.pickup && currentRoute.destination) {
      currentResults = estimateRides(currentRoute);
      renderResults();
    }

    alert("Guardado localmente neste dispositivo.");
  });

  $("#clearHistory").addEventListener("click", () => {
    localStorage.removeItem("tarifaao_history");
    renderHistory();
  });

  $("#locationBtn").addEventListener("click", () => {
    showView("homeView");
    requestCurrentLocation({ force: true });
  });

  $(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    showView("homeView");
  });

  $("#profileBtn").addEventListener("click", () => {
    const isOpen = $("#settingsView")?.classList.contains("active");
    showView(isOpen ? "homeView" : "settingsView");
  });

  $("#openSettingsHelp")?.addEventListener("click", () => showSettingsPanel("help"));
  $("#backSettingsMain")?.addEventListener("click", () => showSettingsPanel("main"));
  $("#settingsOpenTerms")?.addEventListener("click", () => $("#termsDialog").showModal());
  $("#settingsOpenPrivacy")?.addEventListener("click", () => $("#privacyDialog").showModal());
}

function seedDemoResults() {
  const pickupLocation = toLocation("Talatona", -8.9155, 13.1828);
  const destinationLocation = toLocation("Mutamba", -8.8122, 13.2348);

  currentRoute = {
    pickup: pickupLocation.label,
    destination: destinationLocation.label,
    time: liveTimeBucket,
    distance: calculateDistanceKm(pickupLocation, destinationLocation),
    pickupLocation,
    destinationLocation
  };
  currentResults = estimateRides(currentRoute);
  renderResults();
}

function initApp() {
  initLoadingScreen();
  initMapBackground();
  initEvents();
  updateCurrentTimeDisplay();
  window.setInterval(updateCurrentTimeDisplay, 1000);
  updateDistanceDisplay();
  requestCurrentLocation();
}

initApp();
