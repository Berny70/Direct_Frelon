// ==========================
// DONNÉES GLOBALES
// ==========================
const observationColors = ["red", "blue", "green", "white"];
const observations = [];

let currentIndex = null;
let compassActive = false;
let currentHeading = null;
let lastHeading = null;

// ==========================
// MOYENNE CIRCULAIRE
// ==========================
function moyenneCirculaire(degs) {
  if (!degs.length) return null;
  let s = 0, c = 0;
  degs.forEach(d => {
    const r = d * Math.PI / 180;
    s += Math.sin(r);
    c += Math.cos(r);
  });
  let a = Math.atan2(s, c) * 180 / Math.PI;
  return (a + 360) % 360 | 0;
}

// ==========================
// SAUVEGARDE
// ==========================
function saveObservations() {
  const data = observations
    .filter(o => o.lat !== "--" && o.lon !== "--" && o.direction !== null)
    .map(o => ({
      lat: +o.lat,
      lon: +o.lon,
      direction: o.direction,
      color: o.color
    }));
  localStorage.setItem("chronoObservations", JSON.stringify(data));
}

// ==========================
// INITIALISATION UI (APRÈS i18n)
// ==========================
function initUI() {
  const container = document.getElementById("observations");
  if (!container) return;

  container.innerHTML = "";
  observations.length = 0;

  observationColors.forEach((color, i) => {
    const o = {
      lat: "--",
      lon: "--",
      directions: [],
      direction: null,
      color
    };
    observations.push(o);

    const div = document.createElement("div");
    div.className = `chrono ${color}`;
    div.innerHTML = `
      <div class="row row-main">
        <b>${t("observation_label")} ${i + 1}</b>
      </div>

      <div class="row row-info">
        <div><b>Lat :</b> <span id="lat${i}">--</span></div>
        <div><b>Lon :</b> <span id="lon${i}">--</span></div>
        <div><b>Dir :</b> <span id="dir${i}">---</span></div>
      </div>

      <div class="row row-actions">
        <button class="pos" data-i18n="position"></button>
        <button class="compass" data-i18n="compass"></button>
        <button class="det" data-i18n="detail"></button>
      </div>
    `;

    container.appendChild(div);

    div.querySelector(".pos").onclick = () => getPos(i);
    div.querySelector(".compass").onclick = () => openCompass(i);
    div.querySelector(".det").onclick = () => openDET(i);
  });

  document
    .getElementById("btnLoc")
    ?.addEventListener("click", openLocationMenu);

  applyTranslations();
}

// ==========================
// ATTENTE i18n
// ==========================
document.addEventListener("i18n-ready", initUI);

// ==========================
// GPS
// ==========================
function getPos(i) {
  navigator.geolocation.getCurrentPosition(pos => {
    observations[i].lat = pos.coords.latitude.toFixed(5);
    observations[i].lon = pos.coords.longitude.toFixed(5);
    document.getElementById(`lat${i}`).textContent = observations[i].lat;
    document.getElementById(`lon${i}`).textContent = observations[i].lon;
    saveObservations();
  });
}

// ==========================
// DIRECTION
// ==========================
function updateDirection(i) {
  const o = observations[i];
  o.direction = moyenneCirculaire(o.directions);
  document.getElementById(`dir${i}`).textContent =
    o.direction !== null ? o.direction + "°" : "---";
  saveObservations();
}

// ==========================
// BOUSSOLE
// ==========================
function openCompass(i) {
  currentIndex = i;
  compassActive = false;
  currentHeading = null;
  lastHeading = null;

  document.getElementById("compassOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "compassOverlay";
  overlay.innerHTML = `
    <div class="compass-box">
      <h2>${t("compass")}</h2>
      <div id="headingValue">---</div>

      <button data-action="enable">${t("compass_enable")}</button><br><br>
      <button data-action="save">${t("compass_save")}</button><br><br>
      <button data-action="close">${t("close")}</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ==========================
// ORIENTATION
// ==========================
document.addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn || !btn.dataset.action) return;

  if (btn.dataset.action === "enable" && !compassActive) {
    if (DeviceOrientationEvent?.requestPermission) {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") return;
    }
    compassActive = true;
    window.addEventListener("deviceorientation", onOrientation, true);
  }

  if (btn.dataset.action === "save" && currentHeading !== null) {
    observations[currentIndex].directions.push(currentHeading);
    updateDirection(currentIndex);
  }

  if (btn.dataset.action === "close") {
    window.removeEventListener("deviceorientation", onOrientation, true);
    document.getElementById("compassOverlay")?.remove();
    compassActive = false;
  }
});

function onOrientation(e) {
  if (!compassActive || e.alpha == null) return;
  const heading = (360 - e.alpha) % 360 | 0;

  if (lastHeading !== null && Math.abs(heading - lastHeading) > 20) return;
  lastHeading = heading;
  currentHeading = heading;

  document.getElementById("headingValue").textContent = heading + "°";
}

// ==========================
// DÉTAIL
// ==========================
function openDET(i) {
  const o = observations[i];
  document.getElementById("detOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "detOverlay";
  overlay.innerHTML = `
    <div class="det-box">
      <h2>${t("detail")}</h2>
      ${o.directions.map((d,k)=>`
        <div class="det-line">
          ${d}°
          <button data-k="${k}" class="del-dir">❌</button>
        </div>`).join("")}
      <button id="closeDET">${t("close")}</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#closeDET").onclick = () => overlay.remove();
  overlay.querySelectorAll(".del-dir").forEach(b => {
    b.onclick = () => {
      o.directions.splice(b.dataset.k, 1);
      updateDirection(i);
      openDET(i);
    };
  });
}

// ==========================
// LOCALISATION DU NID
// ==========================
function openLocationMenu() {
  document.getElementById("locOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "locOverlay";
  overlay.innerHTML = `
    <div class="loc-box">
      <h2>${t("nest_location")}</h2>

      <button data-action="local">
        🗺️ <span data-i18n="map_local"></span>
      </button>

      <button data-action="send">
        📤 <span data-i18n="map_send"></span>
      </button>

      <button data-action="shared">
        🌍 <span data-i18n="map_shared"></span>
      </button>

      <button data-action="close">
        <span data-i18n="close"></span>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  applyTranslations();

  overlay.onclick = e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.action === "local") location.href = "map.html";
    if (btn.dataset.action === "shared") location.href = "map.html?mode=shared";
    if (btn.dataset.action === "close") overlay.remove();
  };
}
