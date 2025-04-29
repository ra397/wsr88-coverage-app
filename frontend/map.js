// Define EPSG:5070 (NAD83 / CONUS Albers Equal Area)
proj4.defs(
  "EPSG:5070",
  "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 " +
  "+lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs"
);

// Global variables
let map = null;
let currentPolygon = null;
let polygons = [];
let coveragePolygons = [] // original polygons from the existing radar locations
let coverageVisible = true;
const radarCodes = [
  'TMSP', 'TBNA', 'TOKC', 'TMCO', 'KLZK', 'KCBW', 'KABX', 'KBHX', 'KGLD', 'KLBB', 'KLSX', 'KNKX', 'TMCI',
  'KGRR', 'KEMX', 'KFSX', 'KMAX', 'KMOB', 'KVNX', 'TCLT', 'KLGX', 'KAKQ', 'KDYX', 'KEVX', 'KIWX', 'KLNX',
  'KMBX', 'KMXX', 'TMDW', 'TDTW', 'TMKE', 'KBMX', 'KAMX', 'KBBX', 'KDGX', 'KILN', 'KJKL', 'KLTX', 'KSJT',
  'TICH', 'KATX', 'KEPZ', 'KFSX', 'KGRB', 'KIND', 'KSGF', 'KTBW', 'KYUX', 'TLAS', 'TTPA', 'TIAD', 'KBOX',
  'KCXX', 'KDOX', 'KGJX', 'KPUX', 'KRIW', 'KSOX', 'TORD', 'TCMH', 'KVTX', 'TFLL', 'TPHL', 'TRDU', 'TSLC',
  'KCLE', 'KAMA', 'KARX', 'KCBX', 'KCYS', 'KICT', 'KINX', 'KLOT', 'KMKX', 'KPDT', 'KTFX', 'KUEX', 'TIAH',
  'KIWA', 'KEAX', 'KFCX', 'KFFC', 'KNQA', 'KTLH', 'KVBX', 'KFSD', 'KCRP', 'KCLX', 'KFDX', 'KGGW', 'KGRK',
  'KHGX', 'KMAF', 'TDAL', 'KOUN', 'KAMX', 'KBGM', 'KBYX', 'KHTX', 'KMLB', 'KPBZ', 'KEYX', 'KSRX', 'TADW',
  'TDEN', 'TMEM', 'KDDC', 'KCCX', 'KDMX', 'KGWX', 'KMHX', 'KOHX', 'KOTX', 'TBOS', 'TCVG', 'TMSY', 'KGSP',
  'KILX', 'KJGX', 'KHDC', 'TDAY', 'TMIA', 'TIDS', 'KFDR', 'KUDX', 'KRAX', 'KENX', 'KMVX', 'KAPX', 'KLCH',
  'TATL', 'TPHX', 'TSTL', 'TTUL', 'TPBI', 'KRLX', 'KDFX', 'KDVN', 'KMQT', 'KMRX', 'KMSX', 'KPOE', 'KVAX',
  'TBWI', 'THOU', 'TJFK', 'TEWR', 'TPIT', 'KDLH', 'KVWX', 'KCAE', 'KDTX', 'KFWS', 'KHNX', 'KHPX', 'KICX',
  'KLRX', 'KLWX', 'KMPX', 'KPAH', 'KHDX', 'KTYX', 'TLVE', 'KGYX', 'KBIS', 'KBLX', 'KDIX', 'KEOX', 'KESX',
  'KMUX', 'KRTX', 'KTLX', 'KBUF', 'KBRO', 'KDAX', 'KTWX', 'KSFX', 'KSHV', 'TDFW', 'TSDF', 'TDCA', 'KABR',
  'KEWX', 'KRGX', 'KJAX', 'KLVX', 'KOKX', 'KOAX', 'KLIX', 'KMTX', 'KFTG'
];



const thresholdInput = document.getElementById("threshold-input");
document.getElementById('undo-btn').addEventListener('click', undoLastPolygon);
document.getElementById('clear-btn').addEventListener('click', clearAllPolygons);
const coverageCheckbox = document.getElementById("coverage-checkbox");

coverageCheckbox.addEventListener('change', () => {
  coverageVisible = coverageCheckbox.checked;

  coveragePolygons.forEach(polygon => {
    if (coverageVisible) {
      polygon.setMap(map);
    } else {
      polygon.setMap(null);
    }
  });
});

// Called by the Maps API once it’s loaded
function initMap() {
  const centerUSA = { lat: 39.5, lng: -98.35 };

  map = new google.maps.Map(
    document.getElementById("map"),
    { zoom: 5, 
      center: centerUSA,
      draggableCursor: "crosshair",
      styles: [
        {
          featureType: "administrative",
          elementType: "labels",
          stylers: [
            { visibility: "off" }
          ]
        }
      ]
    
    }
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

    // Get the threshold value from the input field
    const rawThreshold = thresholdInput.value.trim();
    const threshold = parseFloat(rawThreshold);

    if (!isNaN(threshold) && isFinite(threshold)) {
      sendRadarRequest(x5070, y5070, threshold);
    } else {
      sendRadarRequest(x5070, y5070);
    }
  });

  coverageCheckbox.checked = true;
  loadAllCoveragePolygons();
}

// Function to handle the form submission of coordinates
function submitCoords() {
  // Get the coordinates from the input fields
  const lat = parseFloat(document.getElementById("latitude-input").value);
  const lng = parseFloat(document.getElementById("longitude-input").value);

  const [x5070, y5070] = proj4(
    "EPSG:4326",
    "EPSG:5070",
    [lng, lat]
  );

  // Send the coordinates to the backend
  const rawThreshold = thresholdInput.value.trim();
  const threshold = parseFloat(rawThreshold);

  if (!isNaN(threshold) && isFinite(threshold)) {
    sendRadarRequest(x5070, y5070, threshold);
  }
  else {
    sendRadarRequest(x5070, y5070);
  }
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
    plotGeoJsonPolygon(geojson, polygons);
  } else {
    const error = await response.json();
    console.error("Error from backend:", error);
  }
}

async function loadAllCoveragePolygons() {
  for (const code of radarCodes) {
    const url = `resources/GeoJSON_OUTPUTS/${code}.geojson`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Missing or invalid file: ${url}`);
        continue;
      }

      const geojsonObject = await response.json();
      plotGeoJsonPolygon(geojsonObject, coveragePolygons); // pass coveragePolygons array
    } catch (error) {
      console.error(`Error loading ${url}:`, error);
    }
  }
}

function plotGeoJsonPolygon(geojsonObject, targetArray) {
  if (!geojsonObject || geojsonObject.type !== 'FeatureCollection') {
    console.error("Expected a FeatureCollection but got:", geojsonObject);
    return [];
  }

  const createdPolygons = [];

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
      strokeColor: '#FF0000',   // <-- default styling
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.35,
      map: map
    });

    polygon.setMap(map);
    targetArray.push(polygon);
    createdPolygons.push(polygon);
  });

  return createdPolygons;
}

// remove the most recent polygon
function undoLastPolygon() {
  const last = polygons.pop();
  if (last) last.setMap(null);
}

// remove all polygons
function clearAllPolygons() {
  polygons.forEach(poly => poly.setMap(null));
  polygons = [];
}