// ==========================
// DONNÉES GLOBALES – V7 i18n
// ==========================
const chronoColors = ["red", "blue", "green", "white"];
const chronos = [];
const DEFAULT_VITESSE = 4;

let detIndex = null;
let currentCompassIndex = null;
let currentHeading = null;
let lastHeading = null;
let compassActive = false;

// ==========================
// mode au démarrage 
// ==========================
const MODE =
  localStorage.getItem("mode") || "direction"; 
// "chrono" | "direction"

const MODE_DIRECTION_ONLY = MODE === "direction";

// ==========================
// MOYENNE CIRCULAIRE
// ==========================
function moyenneCirculaire(degs) {
  if (!degs.length) return 0;
  let sin = 0, cos = 0;
  degs.forEach(d => {
    const r = d * Math.PI / 180;
    sin += Math.sin(r);
    cos += Math.cos(r);
  });
  let a = Math.atan2(sin / degs.length, cos / degs.length);
  let deg = a * 180 / Math.PI;
  if (deg < 0) deg += 360;
  return Math.round(deg);
}

// ==========================
// SAUVEGARDE OBSERVATIONS
// ==========================
  function saveObservations() {
    const obs = chronos.map(c => {
      if (
        c.lat === "--" ||
        c.lon === "--" ||
        c.direction == null
      ) return null;
  
      return {
        lat: parseFloat(c.lat),
        lon: parseFloat(c.lon),
        direction: c.direction,
        directions: c.directions,
        essais: c.essais,
        vitesse: c.vitesse,
        color: c.color
      };
    }).filter(Boolean);
  
    if (obs.length) {
      localStorage.setItem("chronoObservations", JSON.stringify(obs));
    }
  }
// ==========================
// RESTAURATION OBSERVATIONS
// ==========================
  function restoreObservations() {
    const obs = JSON.parse(localStorage.getItem("chronoObservations") || "[]");
  
    obs.forEach((o, i) => {
      if (!chronos[i]) return;
      const c = chronos[i];
  
      // état interne
      c.lat = o.lat.toFixed(5);
      c.lon = o.lon.toFixed(5);
      c.direction = o.direction;
      c.directions = o.directions || [];
      c.essais = o.essais || [];
      c.vitesse = o.vitesse || DEFAULT_VITESSE;
      c.running = false;
      c.startTime = 0;
  
      // UI
      document.getElementById(`lat${i}`).textContent = c.lat;
      document.getElementById(`lon${i}`).textContent = c.lon;
      document.getElementById(`dir${i}`).textContent = c.direction + "°";
  
      if (!MODE_DIRECTION_ONLY) {
        document.getElementById(`vit${i}`).value = c.vitesse;
        updateStats(i); // 🔑 recalcule moyennes & distances
      }
    });
  }

// ==========================
// INITIALISATION UI
// ==========================
window.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("chronos");
  if (!container) return;

  chronoColors.forEach((color, i) => {
    const c = {
      running: false,
      startTime: 0,
      essais: [],
      directions: [],
      vitesse: DEFAULT_VITESSE,
      direction: 0,
      lat: "--",
      lon: "--",
      color
    };
    chronos.push(c);

    const div = document.createElement("div");
    div.className = `chrono ${color}`;
    div.innerHTML = `
      <div class="row row-main">
        <button class="start" data-i18n="start"></button>
        <span class="time" id="t${i}">0.00 s</span>
        <button class="reset" data-i18n="reset"></button>
      </div>

      <div class="row row-info">
        <div><b>Lat.:</b> <span id="lat${i}">--</span></div>
        <div><b>T.moy:</b> <span id="m${i}">0 s</span></div>
        <div>
          <b>Vit.:</b>
          <input type="number" id="vit${i}" value="${DEFAULT_VITESSE}" min="1" max="9"> m/s
        </div>
      </div>

      <div class="row row-info">
        <div><b>Lon.:</b> <span id="lon${i}">--</span></div>
        <div><b>Dir.:</b> <span id="dir${i}">0°</span></div>
        <div><b>Dist.:</b> <span id="d${i}">0 m</span></div>
      </div>

      <div class="row row-actions">
        <button class="pos" data-i18n="position"></button>
        <button class="compass" data-i18n="compass"></button>
        <button class="det" data-i18n="detail"></button>
      </div>
    `;

    container.appendChild(div);
      
      // 🔒 MODE DIRECTION : nettoyage UI AVANT handlers
      if (MODE_DIRECTION_ONLY) {
        // Supprimer chrono
        div.querySelector(".start")?.remove();
        div.querySelector(".time")?.remove();
      
        // Supprimer vitesse et temps moyen
        div.querySelector(`#vit${i}`)?.closest("div")?.remove();
        div.querySelector(`#m${i}`)?.closest("div")?.remove();
      
        // Supprimer distance
        div.querySelector(`#d${i}`)?.closest("div")?.remove();
      }

      
      // Handlers communs (toujours utiles)
      div.querySelector(".pos").onclick = () => getPos(i);
      div.querySelector(".det").onclick = () => openDET(i);
      div.querySelector(".compass").onclick = () => openCompass(i);
      
      // START uniquement en mode chrono
        if (!MODE_DIRECTION_ONLY) {
          div.querySelector(".start").onclick = () => startStop(i);
        
          div.querySelector(`#vit${i}`).oninput = e => {
            c.vitesse = +e.target.value;
            updateStats(i);
          };
        }
        
        // RESET fonctionne dans les deux modes
        if (MODE_DIRECTION_ONLY) {
          div.querySelector(".reset").onclick = () => resetDirectionOnly(i);
        } else {
          div.querySelector(".reset").onclick = () => resetChrono(i);
        }
      // ==========================
      // Sélecteur de mode (header)
      // ==========================
      const btnChrono = document.getElementById("btnModeChrono");
      const btnDirection = document.getElementById("btnModeDirection");
    
      if (btnChrono && btnDirection) {
    
        if (MODE_DIRECTION_ONLY) {
          btnDirection.classList.add("active");
        } else {
          btnChrono.classList.add("active");
        }
    
        btnChrono.onclick = () => {
          localStorage.setItem("mode", "chrono");
          location.reload();
        };
    
        btnDirection.onclick = () => {
          localStorage.setItem("mode", "direction");
          location.reload();
        };
      }



    
  });
 restoreObservations();

  document.getElementById("btnLoc")?.addEventListener("click", openLocationMenu);
});

// ==========================
// START / STOP
// ==========================
function startStop(i) {
  const c = chronos[i];
  const now = Date.now();

  if (!c.running) {
    c.startTime = now;
    c.running = true;
  } else {
    const elapsed = (now - c.startTime) / 1000;
    c.running = false;
    c.essais.push(elapsed);
    document.getElementById(`t${i}`).textContent = elapsed.toFixed(2) + " s";
    updateStats(i);
  }
}

// ==========================
// STATS
// ==========================
function updateStats(i) {
  const c = chronos[i];

  if (!c.essais.length) {
    document.getElementById(`m${i}`).textContent = "0 s";
    document.getElementById(`d${i}`).textContent = "0 m";
    return;
  }

  const total = c.essais.reduce((a, b) => a + b, 0);
  const moy = total / c.essais.length;
  const dist = moy * c.vitesse / 2;

  document.getElementById(`m${i}`).textContent = Math.round(moy) + " s";
  document.getElementById(`d${i}`).textContent = Math.round(dist) + " m";

  saveObservations();
}

// ==========================
// RESET
// ==========================
function resetChrono(i) {
  const c = chronos[i];
  Object.assign(c, {
    running: false,
    startTime: 0,
    essais: [],
    directions: [],
    direction: 0,
    vitesse: DEFAULT_VITESSE,
    lat: "--",
    lon: "--"
  });

  document.getElementById(`t${i}`).textContent = "0.00 s";
  document.getElementById(`m${i}`).textContent = "0 s";
  document.getElementById(`d${i}`).textContent = "0 m";
  document.getElementById(`dir${i}`).textContent = "0°";
  document.getElementById(`lat${i}`).textContent = "--";
  document.getElementById(`lon${i}`).textContent = "--";
  document.getElementById(`vit${i}`).value = DEFAULT_VITESSE;

  saveObservations();
}

// ==========================
// TICK
// ==========================
setInterval(() => {
  const now = Date.now();
  chronos.forEach((c, i) => {
    if (c.running) {
      document.getElementById(`t${i}`).textContent =
        ((now - c.startTime) / 1000).toFixed(2) + " s";
    }
  });
}, 50);

// ==========================
// POSITION GPS (AVEC SPINNER)
// ==========================
function getPos(i) {
  document.getElementById(`lat${i}`).innerHTML =
    '<span class="gps-spinner"></span>';
  document.getElementById(`lon${i}`).textContent = "GPS…";

  navigator.geolocation.getCurrentPosition(
    pos => {
      chronos[i].lat = pos.coords.latitude.toFixed(5);
      chronos[i].lon = pos.coords.longitude.toFixed(5);

      document.getElementById(`lat${i}`).textContent = chronos[i].lat;
      document.getElementById(`lon${i}`).textContent = chronos[i].lon;

      saveObservations();
    },
    () => {
      alert(t("gps_error"));
      document.getElementById(`lat${i}`).textContent = "--";
      document.getElementById(`lon${i}`).textContent = "--";
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

// ==========================
// MENU LOCALISATION
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
    if (btn.dataset.action === "send") envoyerVersCartePartagee();
    if (btn.dataset.action === "close") overlay.remove();
  };
}

// ==========================
// ENVOI SUPABASE
// ==========================
async function envoyerVersCartePartagee() {
  const obs = JSON.parse(localStorage.getItem("chronoObservations") || "[]");
  if (!obs.length) return alert("Aucune observation");

  let phoneId = localStorage.getItem("phone_id");
  if (!phoneId) {
    phoneId = crypto.randomUUID();
    localStorage.setItem("phone_id", phoneId);
  }

    const rows = obs.map(o => {
    
      let distance = 0;
    
      // MODE DIRECTION ONLY
      if (MODE_DIRECTION_ONLY) {
        distance = 500; // valeur fixe pour tracer les tirets
      }
    
      // MODE CHRONO
      else if (o.essais && o.essais.length && o.vitesse) {
        const total = o.essais.reduce((a, b) => a + b, 0);
        const moy = total / o.essais.length;
        distance = moy * o.vitesse / 2;
      }
    
      return {
        lat: o.lat,
        lon: o.lon,
        direction: o.direction,
        distance: Math.round(distance),
        phone_id: phoneId
      };
    });


  const { error } = await window.supabaseClient
    .from("chrono_frelon_geo")
    .insert(rows);

  if (error) {
    console.error(error);
    alert("Erreur Supabase");
  } else {
    alert("Envoyé vers la carte partagée ✅");
  }
}



// ==========================
// DEBOUNCE
// ==========================
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
// ==========================
// GESTION BOUTONS BOUSSOLE
// ==========================
document.addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn || !btn.dataset.action) return;

  const action = btn.dataset.action;

  if (action === "enable" && !compassActive) {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") return;
    }

    lastHeading = null;
    currentHeading = null;

    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);

    compassActive = true;
  }

  if (action === "save") {
    if (currentHeading === null) return;
    chronos[currentCompassIndex].directions.push(currentHeading);
    updateDirection(currentCompassIndex);
  }

  if (action === "close") {
    window.removeEventListener("deviceorientation", onOrientation, true);
    window.removeEventListener("deviceorientationabsolute", onOrientation, true);

    compassActive = false;
    lastHeading = null;
    currentHeading = null;

    document.getElementById("compassOverlay")?.remove();
  }
});
// ==========================
// MISE À JOUR DIRECTION
// ==========================
function updateDirection(i) {
  const c = chronos[i];
  c.direction = moyenneCirculaire(c.directions);
  document.getElementById(`dir${i}`).textContent = c.direction + "°";
  saveObservations();
}
// ==========================
// BOUSSOLE : OVERLAY
// ==========================
function openCompass(i) {
  currentCompassIndex = i;
  currentHeading = null;
  lastHeading = null;
  compassActive = false;

  document.getElementById("compassOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "compassOverlay";
  overlay.innerHTML = `
    <div class="compass-box">
      <h2>${t("compass_title")} ${chronos[i].color}</h2>
      <div id="headingValue">---</div>
        <button data-action="enable">
          <span data-i18n="compass_enable"></span>
        </button><br><br>
        
        <button data-action="save">
          <span data-i18n="compass_save"></span>
        </button><br><br>
        
        <button data-action="close">
          <span data-i18n="close"></span>
        </button>
    </div>
  `;
  document.body.appendChild(overlay);
  applyTranslations();
}
// ==========================
// ORIENTATION DU TÉLÉPHONE
// ==========================
function onOrientation(e) {
  if (!compassActive) return;

  let heading = null;

  if (typeof e.webkitCompassHeading === "number") {
    heading = e.webkitCompassHeading;
  } else if (e.absolute === true && typeof e.alpha === "number") {
    heading = (360 - e.alpha) % 360;
  }

  if (heading === null || isNaN(heading)) return;

  if (lastHeading !== null) {
    let delta = Math.abs(heading - lastHeading);
    if (delta > 180) delta = 360 - delta;
    if (delta > 20) return;
  }

  lastHeading = heading;
  currentHeading = Math.round(heading);

  const el = document.getElementById("headingValue");
  if (el) el.textContent = currentHeading + "°";
}
// ==========================
// DÉTAIL DES ESSAIS / DIRECTIONS
// ==========================
function openDET(i) {
  detIndex = i;
  const c = chronos[i];

  document.getElementById("detOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "detOverlay";
  overlay.className = c.color;

  overlay.innerHTML = `
    <div class="det-box">
      <h2>${t("detail_title")} ${c.color}</h2>

      <h3>${t("directions")}</h3>

      ${
        c.directions.length
          ? c.directions.map((d, k) => `
              <div class="det-line">
                ${d}°
                <button class="del-dir" data-k="${k}">
                  ${t("delete")}
                </button>
              </div>
            `).join("")
          : `<div class="det-line"><i>${t("no_direction") || "Aucune direction enregistrée"}</i></div>`
      }

      <br>
      <button id="closeDET">${t("close")}</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // fermeture
  overlay.querySelector("#closeDET").onclick = () => overlay.remove();

  // suppression d’une direction
  overlay.querySelectorAll(".del-dir").forEach(btn => {
    btn.onclick = () => {
      chronos[detIndex].directions.splice(btn.dataset.k, 1);
      updateDirection(detIndex);
      openDET(detIndex);
    };
  });
}
function resetDirectionOnly(i) {
  const c = chronos[i];

  c.lat = "--";
  c.lon = "--";
  c.directions = [];
  c.direction = 0;

  document.getElementById(`lat${i}`).textContent = "--";
  document.getElementById(`lon${i}`).textContent = "--";
  document.getElementById(`dir${i}`).textContent = "0°";

  saveObservations();
}

































