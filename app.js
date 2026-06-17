const OWNER_WHATSAPP = "351963201382"; // Troca pelo teu número. Ex: 244921744420

const APP_VERSION = "v1.01-beta";
const LUANDA_CENTER = { lat: -8.839, lng: 13.2894, zoom: 12 };
const GOOGLE_MAPS_KEY = "YOUR_GOOGLE_MAPS_KEY_HERE";
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content.trim() ||
  window.TARIFAAO_SUPABASE_URL ||
  "";
const SUPABASE_PUBLISHABLE_KEY = document.querySelector('meta[name="supabase-publishable-key"]')?.content.trim() ||
  window.TARIFAAO_SUPABASE_PUBLISHABLE_KEY ||
  "";

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
let userCurrentLocation = null;
let activeMapFieldId = null;
let pendingMapLocation = null;
let mapSelectionToken = 0;
let suggestionTimer = null;
let suggestionToken = 0;
let activeSuggestionFieldId = null;
let registrationModalShownThisSession = false;

const geocodeCache = new Map();
const suggestionCache = new Map();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let toastTimer = null;

function showToast(message, duration = 2800) {
  const toast = $("#toast");
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), duration);
}

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

function updatePrivacyCopy() {
  const paragraphs = $$("#privacyDialog .legal-copy p");
  if (paragraphs[0]) {
    paragraphs[0].textContent = "O Tarifa.ao é um MVP com backend leve para melhorar estimativas comunitárias quando o Supabase estiver configurado.";
  }
  if (paragraphs[3]) {
    paragraphs[3].textContent = "Histórico local fica neste dispositivo. Pesquisas e contribuições podem ser guardadas no Supabase para melhorar o serviço.";
  }
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

function getDeviceId() {
  const storageKey = "tarifaao_device_id";
  let id = localStorage.getItem(storageKey);
  if (id) return id;

  id = crypto?.randomUUID?.() || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(storageKey, id);
  return id;
}

function getVisitor() {
  try {
    const stored = JSON.parse(localStorage.getItem("tarifaao_visitor") || "null");
    if (stored && stored.id) return stored;
  } catch {}
  return { id: getDeviceId(), isRegistered: false };
}

function saveVisitor(data) {
  localStorage.setItem("tarifaao_visitor", JSON.stringify(data));
}

async function registerVisitor(email, firstName, lastName) {
  const id = getDeviceId();
  const visitor = {
    id,
    email: email.trim().toLowerCase(),
    firstName: firstName.trim(),
    lastName: (lastName || "").trim(),
    isRegistered: true,
    registeredAt: new Date().toISOString()
  };

  saveVisitor(visitor);
  updateSettingsProfile();

  await supabaseUpsert("visitors", {
    id,
    email: visitor.email,
    first_name: visitor.firstName,
    last_name: visitor.lastName || null,
    device_id: id,
    app_version: APP_VERSION
  });

  return visitor;
}

function shouldShowRegistrationModal() {
  if (registrationModalShownThisSession) return false;
  const visitor = getVisitor();
  if (visitor.isRegistered) return false;

  const dismissed = localStorage.getItem("tarifaao_reg_dismissed");
  if (dismissed) {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - parseInt(dismissed, 10) < sevenDays) return false;
  }

  return true;
}

function updateSettingsProfile() {
  const visitor = getVisitor();
  const photoEl = $("#settingsProfilePhoto");
  const nameEl = $("#settingsProfileName");
  const linkBtn = $("#profileLinkBtn");

  if (photoEl) {
    if (visitor.isRegistered) {
      const initials = [visitor.firstName?.[0], visitor.lastName?.[0]]
        .filter(Boolean).join("").toUpperCase() || "TB";
      photoEl.textContent = initials;
    } else {
      photoEl.textContent = "?";
    }
  }

  if (nameEl) {
    nameEl.textContent = visitor.isRegistered ? `Olá, ${visitor.firstName}` : "Visitante";
  }

  if (linkBtn) {
    linkBtn.textContent = visitor.isRegistered ? "Editar perfil" : "Registar";
  }
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

async function supabaseInsert(table, payload) {
  if (!isSupabaseConfigured()) return;

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Supabase insert failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("Tarifa.ao Supabase sync skipped.", error);
  }
}

async function supabaseUpsert(table, payload) {
  if (!isSupabaseConfigured()) return;

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Supabase upsert failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("Tarifa.ao Supabase sync skipped.", error);
  }
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

const GRAYSCALE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ saturation: -85 }, { lightness: 5 }] },
  { elementType: "labels.text.fill", stylers: [{ saturation: -60 }, { lightness: -10 }] },
  { elementType: "labels.text.stroke", stylers: [{ visibility: "on" }, { lightness: 16 }] },
  { featureType: "road", elementType: "geometry", stylers: [{ lightness: 12 }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] }
];

window.initGoogleMapsCallback = function () {
  initMapBackground();
};

function initMapBackground() {
  const canvas = $("#appMap");
  if (!canvas || !window.google?.maps || backgroundMap) return;

  backgroundMap = new google.maps.Map(canvas, {
    center: { lat: LUANDA_CENTER.lat, lng: LUANDA_CENTER.lng },
    zoom: LUANDA_CENTER.zoom,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
    gestureHandling: "greedy",
    styles: GRAYSCALE_MAP_STYLE
  });

  document.body.classList.add("google-map-ready");
  updateRouteMap(currentRoute);
}

function clearBackgroundRoute() {
  backgroundRouteMarkers.forEach(marker => marker.setMap(null));
  backgroundRouteMarkers = [];

  if (backgroundRouteLine) {
    backgroundRouteLine.setMap(null);
    backgroundRouteLine = null;
  }
}

function createRouteMarker(point, index) {
  return new google.maps.Marker({
    position: { lat: point.lat, lng: point.lng },
    map: backgroundMap,
    clickable: false,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: index === 0 ? 7 : 8,
      fillColor: index === 0 ? "#071a2f" : "#0f62fe",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3
    }
  });
}

function updateRouteMap(route = currentRoute) {
  if (!backgroundMap || !window.google?.maps) return;

  clearBackgroundRoute();

  const pickup = route.pickupLocation || fieldLocations.pickupInput;
  const destination = route.destinationLocation || fieldLocations.destinationInput;
  const points = [pickup, destination].filter(isValidLocation);

  if (!points.length) {
    backgroundMap.setCenter({ lat: LUANDA_CENTER.lat, lng: LUANDA_CENTER.lng });
    backgroundMap.setZoom(LUANDA_CENTER.zoom);
    return;
  }

  points.forEach((point, index) => {
    backgroundRouteMarkers.push(createRouteMarker(point, index));
  });

  if (isValidLocation(pickup) && isValidLocation(destination)) {
    backgroundRouteLine = new google.maps.Polyline({
      path: [
        { lat: pickup.lat, lng: pickup.lng },
        { lat: destination.lat, lng: destination.lng }
      ],
      strokeColor: "#071a2f",
      strokeOpacity: 0.82,
      strokeWeight: 4,
      map: backgroundMap,
      clickable: false
    });

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: pickup.lat, lng: pickup.lng });
    bounds.extend({ lat: destination.lat, lng: destination.lng });
    backgroundMap.fitBounds(bounds, { top: 96, right: 96, bottom: 96, left: 96 });
  } else {
    backgroundMap.setCenter({ lat: points[0].lat, lng: points[0].lng });
    backgroundMap.setZoom(14);
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
    const contrib = ride.contributions ? `${ride.contributions} contrib.` : "base";
    const card = document.createElement("article");
    card.className = `ride-card ${i === 0 ? "best" : ""}`;
    card.innerHTML = `
      <img class="ride-logo" src="${escapeHtml(ride.logo)}" alt="${escapeHtml(ride.name)}" loading="lazy">
      <div class="ride-main">
        <div class="ride-title">
          <strong>${escapeHtml(ride.name)}</strong>
          ${i === 0 ? `<span class="badge">${bestLabel}</span>` : ""}
        </div>
        <div class="ride-sub">${escapeHtml(ride.type)} · ${ride.eta} min · ${contrib}</div>
      </div>
      <div class="ride-price">
        <strong>${formatKz(ride.estimate)}</strong>
        <span>${formatKz(ride.minRange)}–${formatKz(ride.maxRange)}</span>
      </div>
    `;
    card.addEventListener("click", () => selectRide(ride));
    list.appendChild(card);
  });
}

function renderResultsSkeleton(pickup, destination) {
  $("#summaryPickup").textContent = pickup || "Origem";
  $("#summaryDestination").textContent = destination || "Destino";
  $("#summaryRoute").textContent = `${pickup || "Origem"} → ${destination || "Destino"}`;
  $("#resultsMeta").textContent = "A calcular distância e estimativas...";

  const list = $("#rideList");
  list.innerHTML = Array.from({ length: 4 }).map(() => `
    <article class="ride-card skeleton-card" aria-hidden="true">
      <span class="skeleton-logo"></span>
      <div class="ride-main">
        <span class="skeleton-line strong"></span>
        <span class="skeleton-line"></span>
      </div>
      <div class="ride-price">
        <span class="skeleton-line price"></span>
        <span class="skeleton-line tiny"></span>
      </div>
    </article>
  `).join("");
}

function compareRoute(route) {
  currentRoute = {
    ...route,
    searchedAt: new Date().toISOString()
  };
  currentResults = estimateRides(currentRoute);
  renderResults();
  addSearchHistory(currentRoute);
  trackRouteSearch(currentRoute);
  updateRouteMap(currentRoute);
  showView("resultsView");

  if (shouldShowRegistrationModal()) {
    registrationModalShownThisSession = true;
    window.setTimeout(() => $("#registerDialog")?.showModal(), 2000);
  }
}

function selectRide(ride) {
  selectedRide = ride;
  $("#selectedApp").textContent = ride.name;
  $("#selectedPrice").textContent = formatKz(ride.estimate);
  $("#redirectTitle").textContent = `Abrir ${ride.name}`;
  $("#openExternalLink").href = ride.url;
  showView("redirectView");
  trackEvent("app_view", { app_id: ride.id, app_name: ride.name, estimated_price: Math.round(ride.estimate) });
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

function saveContributionAndSync(item, source = "local") {
  saveContribution(item);
  trackFareContribution(item, source);
}

function trackFareContribution(item, source = "local") {
  supabaseInsert("fare_contributions", {
    visitor_id: getDeviceId(),
    device_id: getDeviceId(),
    app_version: APP_VERSION,
    route_key: item.routeKey,
    app_name: item.app,
    pickup_label: item.pickup,
    destination_label: item.destination,
    distance_km: Number(item.distance) || null,
    time_bucket: item.time,
    price_kz: item.price,
    eta_text: item.eta || null,
    note: item.note || null,
    source
  });
}

function trackRouteSearch(route) {
  const pickupLocation = route.pickupLocation || {};
  const destinationLocation = route.destinationLocation || {};

  supabaseInsert("route_searches", {
    visitor_id: getDeviceId(),
    device_id: getDeviceId(),
    app_version: APP_VERSION,
    pickup_label: route.pickup,
    destination_label: route.destination,
    pickup_lat: Number.isFinite(Number(pickupLocation.lat)) ? Number(pickupLocation.lat) : null,
    pickup_lng: Number.isFinite(Number(pickupLocation.lng)) ? Number(pickupLocation.lng) : null,
    destination_lat: Number.isFinite(Number(destinationLocation.lat)) ? Number(destinationLocation.lat) : null,
    destination_lng: Number.isFinite(Number(destinationLocation.lng)) ? Number(destinationLocation.lng) : null,
    distance_km: Number(route.distance) || null,
    time_bucket: route.time,
    sort_mode: currentSort,
    results_count: currentResults.length,
    source: "web_mvp"
  });
}

function trackEvent(eventType, payload = {}) {
  supabaseInsert("events", {
    visitor_id: getDeviceId(),
    device_id: getDeviceId(),
    event_type: eventType,
    payload,
    app_version: APP_VERSION
  });
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
  trackEvent("contribute_open");
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
    showToast("Coloca um preço válido para continuar.");
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

  if (activeSuggestionFieldId === fieldId) hideAddressSuggestions();
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

function formatGoogleAddress(result) {
  const components = result.address_components || [];
  const get = (type) => components.find(c => c.types.includes(type))?.long_name;

  const parts = [
    get("route") || get("neighborhood") || get("sublocality_level_2") || get("sublocality_level_1"),
    get("sublocality_level_1") || get("locality"),
    get("locality") || get("administrative_area_level_1")
  ].filter(Boolean);

  const seen = new Set();
  const unique = parts.filter(p => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return unique.slice(0, 3).join(", ") || result.formatted_address || "";
}

let _geocoder = null;
function getGeocoder() {
  if (!_geocoder && window.google?.maps) _geocoder = new google.maps.Geocoder();
  return _geocoder;
}

let _autocompleteService = null;
function getAutocompleteService() {
  if (!_autocompleteService && window.google?.maps?.places) {
    _autocompleteService = new google.maps.places.AutocompleteService();
  }
  return _autocompleteService;
}

async function reverseGeocode(lat, lng) {
  const geocoder = getGeocoder();
  if (!geocoder) return toLocation(formatFallbackAddress(lat, lng), lat, lng);

  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      const label = status === "OK" && results[0]
        ? formatGoogleAddress(results[0])
        : formatFallbackAddress(lat, lng);
      resolve(toLocation(label, lat, lng));
    });
  });
}

async function geocodeAddress(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const cacheKey = cleanQuery.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const geocoder = getGeocoder();
  if (!geocoder) return null;

  return new Promise((resolve) => {
    geocoder.geocode(
      { address: cleanQuery, componentRestrictions: { country: "ao" } },
      (results, status) => {
        const match = status === "OK" && results?.[0];
        const location = match
          ? toLocation(
              formatGoogleAddress(match),
              match.geometry.location.lat(),
              match.geometry.location.lng()
            )
          : null;
        geocodeCache.set(cacheKey, location);
        resolve(location);
      }
    );
  });
}

async function geocodeSuggestions(query) {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  const cacheKey = cleanQuery.toLowerCase();
  if (suggestionCache.has(cacheKey)) {
    return sortSuggestionsByUserDistance(suggestionCache.get(cacheKey));
  }

  const service = getAutocompleteService();
  if (!service) return [];

  const predictions = await new Promise((resolve) => {
    service.getPlacePredictions(
      { input: cleanQuery, componentRestrictions: { country: "ao" } },
      (preds, status) =>
        resolve(status === google.maps.places.PlacesServiceStatus.OK ? preds || [] : [])
    );
  });

  const geocoder = getGeocoder();
  const results = await Promise.all(
    predictions.slice(0, 5).map(pred =>
      new Promise((resolve) => {
        geocoder.geocode({ placeId: pred.place_id }, (res, status) => {
          if (status !== "OK" || !res?.[0]) { resolve(null); return; }
          const loc = res[0].geometry.location;
          resolve({
            ...toLocation(
              pred.structured_formatting?.main_text || pred.description.split(",")[0].trim(),
              loc.lat(),
              loc.lng()
            ),
            detail: pred.description
          });
        });
      })
    )
  );

  const suggestions = results.filter(Boolean).filter(isValidLocation);
  suggestionCache.set(cacheKey, suggestions);
  return sortSuggestionsByUserDistance(suggestions);
}

function getSuggestionDistance(location) {
  if (!isValidLocation(userCurrentLocation) || !isValidLocation(location)) return null;
  return calculateDistanceKm(userCurrentLocation, location);
}

function sortSuggestionsByUserDistance(suggestions) {
  return [...suggestions]
    .map(item => ({
      ...item,
      distanceFromUser: getSuggestionDistance(item)
    }))
    .sort((a, b) => {
      const distanceA = Number.isFinite(a.distanceFromUser) ? a.distanceFromUser : Number.POSITIVE_INFINITY;
      const distanceB = Number.isFinite(b.distanceFromUser) ? b.distanceFromUser : Number.POSITIVE_INFINITY;
      return distanceA - distanceB;
    });
}

function formatSuggestionDetail(item) {
  if (Number.isFinite(item.distanceFromUser)) {
    return `${formatDistance(item.distanceFromUser)} de ti · ${item.detail || "Angola"}`;
  }

  return item.detail || "Angola";
}

function getFieldLabel(fieldId) {
  return fieldId === "pickupInput" ? "origem" : "destino";
}

function hideAddressSuggestions() {
  const panel = $("#addressSuggestions");
  if (!panel) return;
  window.clearTimeout(suggestionTimer);
  suggestionToken += 1;
  panel.hidden = true;
  panel.classList.remove("loading");
  panel.innerHTML = "";
  activeSuggestionFieldId = null;
}

function renderSuggestionSkeleton(fieldId) {
  const panel = $("#addressSuggestions");
  if (!panel) return;

  activeSuggestionFieldId = fieldId;
  panel.hidden = false;
  panel.classList.add("loading");
  panel.innerHTML = `
    <div class="suggestions-title">A procurar ${getFieldLabel(fieldId)}</div>
    <div class="suggestion-skeleton"></div>
    <div class="suggestion-skeleton short"></div>
    <div class="suggestion-skeleton"></div>
  `;
}

function renderAddressSuggestions(fieldId, suggestions) {
  const panel = $("#addressSuggestions");
  if (!panel || activeSuggestionFieldId !== fieldId) return;

  panel.hidden = false;
  panel.classList.remove("loading");

  if (!suggestions.length) {
    panel.innerHTML = `
      <div class="suggestions-title">Sem resultados rápidos</div>
      <p>Continua a escrever ou define o ponto no mapa.</p>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="suggestions-title">Sugestões para ${getFieldLabel(fieldId)}</div>
    <div class="suggestions-list">
      ${suggestions.map((item, index) => `
        <button type="button" class="suggestion-item" data-index="${index}">
          <span class="suggestion-pin"></span>
          <span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(formatSuggestionDetail(item))}</small>
          </span>
        </button>
      `).join("")}
    </div>
  `;

  panel.querySelectorAll(".suggestion-item").forEach(button => {
    button.addEventListener("click", () => {
      const location = suggestions[Number(button.dataset.index)];
      setFieldLocation(fieldId, location);
      hideAddressSuggestions();

      const nextField = fieldId === "pickupInput" ? $("#destinationInput") : null;
      if (nextField && !nextField.value.trim()) nextField.focus();
    });
  });
}

function queueAddressSuggestions(fieldId) {
  const input = document.getElementById(fieldId);
  const query = input?.value.trim() || "";

  window.clearTimeout(suggestionTimer);

  if (query.length < 2) {
    hideAddressSuggestions();
    return;
  }

  const token = ++suggestionToken;
  activeSuggestionFieldId = fieldId;

  suggestionTimer = window.setTimeout(async () => {
    renderSuggestionSkeleton(fieldId);
    try {
      const suggestions = await geocodeSuggestions(query);
      if (token !== suggestionToken || activeSuggestionFieldId !== fieldId) return;
      renderAddressSuggestions(fieldId, suggestions);
    } catch {
      if (token !== suggestionToken || activeSuggestionFieldId !== fieldId) return;
      renderAddressSuggestions(fieldId, []);
    }
  }, 260);
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
    queueAddressSuggestions(fieldId);
  });

  input.addEventListener("focus", () => {
    updateMapOption(input);
    queueAddressSuggestions(fieldId);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideAddressSuggestions();
  });
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
  if (!isValidLocation(location) || !pickerMap) return;

  if (!pickerMarker) {
    pickerMarker = new google.maps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map: pickerMap
    });
  } else {
    pickerMarker.setPosition({ lat: location.lat, lng: location.lng });
  }
}

function initPickerMap(center) {
  const canvas = $("#mapCanvas");
  canvas.classList.remove("unavailable");
  canvas.textContent = "";

  if (!window.google?.maps) {
    canvas.classList.add("unavailable");
    canvas.textContent = "Mapa indisponível. Confirma a ligação à internet e tenta novamente.";
    return;
  }

  if (!pickerMap) {
    pickerMap = new google.maps.Map(canvas, {
      center: { lat: center.lat, lng: center.lng },
      zoom: center.zoom || 13,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      styles: GRAYSCALE_MAP_STYLE
    });
    pickerMap.addListener("click", (event) => {
      selectMapPoint(event.latLng.lat(), event.latLng.lng());
    });
  } else {
    pickerMap.setCenter({ lat: center.lat, lng: center.lng });
    pickerMap.setZoom(center.zoom || 13);
  }

  if (pickerMarker) {
    pickerMarker.setMap(null);
    pickerMarker = null;
  }

  const existing = fieldLocations[activeMapFieldId];
  if (isValidLocation(existing)) setPickerMarker(existing);
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
    userCurrentLocation = fallbackLocation;

    if (!options.force && input.value.trim() && input.dataset.autofilledLocation !== "true") {
      input.placeholder = placeholder;
      return;
    }

    setFieldLocation("pickupInput", fallbackLocation, { autofill: true });

    try {
      const resolvedLocation = await reverseGeocode(latitude, longitude);
      userCurrentLocation = resolvedLocation;
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
    userCurrentLocation = null;
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

  hideAddressSuggestions();
  submitButton.disabled = true;
  submitButton.textContent = "A calcular...";
  renderResultsSkeleton(pickup, destination);
  showView("resultsView");

  try {
    const pickupLocation = await resolveLocationFromInput("pickupInput");
    const destinationLocation = await resolveLocationFromInput("destinationInput");
    const distance = calculateDistanceKm(pickupLocation, destinationLocation);

    if (!distance) {
      showView("homeView");
      showToast("Não consegui calcular a distância. Define os pontos no mapa.");
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
    showView("homeView");
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
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".search-panel")) hideAddressSuggestions();
  });

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
      $("#rideList")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

    saveContributionAndSync(item, "whatsapp");
    sendContributionWhatsApp(item);
    trackEvent("contribute_submit", { app: item.app, price: item.price, source: "whatsapp" });
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

    saveContributionAndSync(item, "local_only");
    trackEvent("contribute_submit", { app: item.app, price: item.price, source: "local_only" });
    resetContributionForm();
    $("#contributeDialog").close();

    if (currentRoute.pickup && currentRoute.destination) {
      currentResults = estimateRides(currentRoute);
      renderResults();
    }

    showToast("Guardado neste dispositivo.");
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

  $("#swapFields")?.addEventListener("click", () => {
    const pickupInput = $("#pickupInput");
    const destInput = $("#destinationInput");
    const pickupVal = pickupInput.value;
    const destVal = destInput.value;
    const pickupLoc = fieldLocations.pickupInput;
    const destLoc = fieldLocations.destinationInput;

    pickupInput.value = destVal;
    destInput.value = pickupVal;
    fieldLocations.pickupInput = destLoc;
    fieldLocations.destinationInput = pickupLoc;

    updateDistanceDisplay();
    updateRouteMap();
  });

  $("#inviteBtn")?.addEventListener("click", async () => {
    const shareData = {
      title: "Tarifa.ao",
      text: "Compara tarifas de táxi em Angola antes de pedir uma viagem.",
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copiado!");
      }
    } catch {
      // Utilizador cancelou o share
    }
  });

  $("#openExternalLink")?.addEventListener("click", () => {
    if (selectedRide) {
      trackEvent("app_click", { app_id: selectedRide.id, app_name: selectedRide.name, estimated_price: Math.round(selectedRide.estimate) });
    }
  });

  $$(".signout-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const visitor = getVisitor();
      if (visitor.isRegistered) {
        saveVisitor({ id: visitor.id, isRegistered: false });
        updateSettingsProfile();
        showToast("Dados de perfil removidos deste dispositivo.");
      } else {
        showToast("Conta não necessária nesta versão beta.");
      }
    });
  });

  $$(".profile-link").forEach(btn => {
    btn.addEventListener("click", () => {
      if (getVisitor().isRegistered) {
        showToast("Edição de perfil disponível em breve.");
      } else {
        $("#registerDialog")?.showModal();
      }
    });
  });

  $("#registerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#regEmail").value.trim();
    const firstName = $("#regFirstName").value.trim();
    const lastName = $("#regLastName").value.trim();

    if (!email || !firstName) {
      showToast("Preenche o email e o nome próprio.");
      return;
    }

    const submitBtn = $("#regSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "A registar...";

    try {
      await registerVisitor(email, firstName, lastName);
      trackEvent("register");
      $("#registerDialog").close();
      showToast(`Bem-vindo, ${firstName}! Registo guardado.`);
    } catch {
      showToast("Erro ao registar. Tenta novamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Registar";
    }
  });

  const dismissRegister = () => {
    localStorage.setItem("tarifaao_reg_dismissed", String(Date.now()));
    $("#registerDialog")?.close();
  };

  $("#skipRegister")?.addEventListener("click", dismissRegister);
  $("#closeRegister")?.addEventListener("click", dismissRegister);
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
  updatePrivacyCopy();
  initEvents();
  updateCurrentTimeDisplay();
  window.setInterval(updateCurrentTimeDisplay, 1000);
  updateDistanceDisplay();
  requestCurrentLocation();
  updateSettingsProfile();
  trackEvent("app_open");
}

initApp();
