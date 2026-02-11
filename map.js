// ==========================
// MODE (LOCAL / PARTAGÉ)
// ==========================
const mapSearchParams = new URLSearchParams(window.location.search);
const MODE_SHARED = mapSearchParams.get("mode") === "shared";

// ==========================
// DONNÉES
// ==========================
let observations = [];

// ==========================
// INITIALISATION CARTE
// ==========================
const map = L.map("map").setView([46.5, 2.5], 6);

// Fond de carte
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ==========================
// MODE LOCAL
// ==========================
if (!MODE_SHARED) {
  observations = JSON.parse(
    localStorage.getItem("chronoObservations") || "[]"
  );

  // 🔧 NORMALISATION (OPTION B compatible)
  observations = observations.map(o => {
    if (o.distance == null) {
      o.distance = 0; // distance inconnue → hypothèse
    }
    return o;
  });

  if (!observations.length) {
    alert(
      t("map_no_data_title") + "\n\n" +
      "• " + t("map_no_data_1") + "\n" +
      "• " + t("map_no_data_2")
    );
    map.setView([46.5, 2.5], 6);
  } else {
    centrerCarte(observations);
    afficherObservations();
  }
}

// ==========================
// MODE PARTAGÉ
// ==========================
if (MODE_SHARED) {
  chargerObservationsPartagees();
}

// ==========================
// SAUVEGARDE ZOOM LOCAL
// ==========================
map.on("moveend", () => {
  if (MODE_SHARED) return;

  const center = map.getCenter();
  const zoom = map.getZoom();

  localStorage.setItem(
    "mapView",
    JSON.stringify({
      center: [center.lat, center.lng],
      zoom
    })
  );
});

// ==========================
// AFFICHAGE OBSERVATIONS
// ==========================
function afficherObservations() {
  observations.forEach(obs => {

    if (
      obs.lat == null ||
      obs.lon == null ||
      obs.direction == null
    ) return;

    const start = [obs.lat, obs.lon];
    const color = obs.color || "red";

    // Point d'observation
    const marker = L.circleMarker(start, {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(
      `<b>${t("map_station")}</b><br>
       ${t("map_distance")}: ${obs.distance} m<br>
       ${t("map_direction")}: ${obs.direction}°`
    );

    let dest;
    let polylineOptions;

    // ==========================
    // CAS 1 — distance inconnue
    // ==========================
    if (obs.distance === 0) {

      dest = destinationPoint(
        obs.lat,
        obs.lon,
        obs.direction,
        500
      );

      polylineOptions = {
        color,
        weight: 2,
        dashArray: "6 6",
        opacity: 0.8
      };

    // ==========================
    // CAS 2 — distance connue
    // ==========================
    } else {

      dest = destinationPoint(
        obs.lat,
        obs.lon,
        obs.direction,
        obs.distance
      );

      polylineOptions = {
        color,
        weight: 3,
        opacity: 1
      };
    }

    L.polyline(
      [start, [dest.lat, dest.lon]],
      polylineOptions
    ).addTo(map);
  });
}

// ==========================
// CENTRAGE CARTE
// ==========================
function centrerCarte(data) {
  const points = data
    .filter(o => o.lat && o.lon)
    .map(o => [o.lat, o.lon]);

  const savedView = localStorage.getItem("mapView");

  if (!MODE_SHARED && savedView) {
    const { center, zoom } = JSON.parse(savedView);
    map.setView(center, zoom);

  } else if (points.length === 1) {
    map.setView(points[0], 16);

  } else if (points.length > 1) {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [30, 30] });

  } else {
    map.setView([46.5, 2.5], 6);
  }
}

// ==========================
// SUPABASE – RPC
// ==========================
async function chargerDonneesAutour(lat, lon) {
  const { data, error } = await window.supabaseClient.rpc(
    "get_nearby_frelons",
    {
      lat,
      lon,
      radius_m: 10000
    }
  );

  if (error) {
    console.error("Erreur RPC Supabase :", error);
    return [];
  }

  return data || [];
}

// ==========================
// MODE PARTAGÉ : CHARGEMENT
// ==========================
async function chargerObservationsPartagees() {
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      observations = await chargerDonneesAutour(lat, lon);

      // normalisation distance
      observations = observations.map(o => {
        if (o.distance == null) o.distance = 0;
        return o;
      });

      if (!observations.length) {
        alert(
          t("map_no_shared_data") ||
          "Aucune donnée partagée dans un rayon de 10 km"
        );
        map.setView([lat, lon], 11);
        return;
      }

      centrerCarte(observations);
      afficherObservations();
    },
    () => {
      alert(t("gps_error") || "GPS indisponible");
      map.setView([46.5, 2.5], 6);
    }
  );
}

// ==========================
// GÉOMÉTRIE : POINT DESTINATION
// ==========================
function destinationPoint(lat, lon, bearing, distance) {
  const R = 6371000;
  const δ = distance / R;
  const θ = bearing * Math.PI / 180;

  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
    Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    lat: φ2 * 180 / Math.PI,
    lon: λ2 * 180 / Math.PI
  };
}

// ==========================
// BOUTON RETOUR
// ==========================
document.getElementById("btnBackMap")?.addEventListener("click", () => {
  location.href = "index.html";
});
