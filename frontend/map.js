// Define EPSG:5070 (NAD83 / CONUS Albers Equal Area)
proj4.defs(
  "EPSG:5070",
  "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 " +
  "+lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs"
);

// Global variables
let map = null;
let currentPolygon = null;

// Called by the Maps API once it’s loaded
function initMap() {
  const centerUSA = { lat: 39.5, lng: -98.35 };

  map = new google.maps.Map(  // <<<<<<< Initialize global map
    document.getElementById("map"),
    { zoom: 4, center: centerUSA }
  );

  map.addListener("click", (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Reproject [lng, lat] from EPSG:4326 → EPSG:5070
    const [x5070, y5070] = proj4(
      "EPSG:4326",
      "EPSG:5070",
      [lng, lat]
    );

    // Send the coordinates to the server
    sendRadarRequest(x5070, y5070);
  });
}

async function sendRadarRequest(easting, northing, maxAlt = 3000) {
  const response = await fetch("http://127.0.0.1:8000/process_radar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      easting: easting,
      northing: northing,
      max_alt: maxAlt
    })
  });

  if (response.ok) {
    const data = await response.json();
    console.log("GeoJSON received:", data.geojson);

    const geojson = data.geojson;
    plotGeoJsonPolygon(geojson);
  } else {
    const error = await response.json();
    console.error("Error from backend:", error);
  }
}

function plotGeoJsonPolygon(geojsonObject) {
  if (!geojsonObject || geojsonObject.type !== 'FeatureCollection') {
    console.error("Expected a FeatureCollection but got:", geojsonObject);
    return;
  }

  geojsonObject.features.forEach((feature) => {
    if (!feature.geometry || feature.geometry.type !== 'Polygon') {
      console.warn("Skipping non-Polygon feature:", feature);
      return;
    }

    const polygonCoords = [];

    const rings = feature.geometry.coordinates;

    rings.forEach((ring) => {
      const path = ring.map(([x, y]) => {
        const [lon, lat] = proj4('EPSG:5070', 'EPSG:4326', [x, y]);
        return { lat: lat, lng: lon };
      });
      polygonCoords.push(path);
    });

    const polygon = new google.maps.Polygon({
      paths: polygonCoords,
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.35
    });

    polygon.setMap(map);
  });
}