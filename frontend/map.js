const server = window._env_dev.SERVER_URL;

let map;
let usgsSitesLayer;
const usgsBasinLayers = {}; // Each basin boundary is its own Data layer

let usgsPopulationMap = {};

let isLoading = false;

proj4.defs("EPSG:3857",
  "+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 " +
  "+datum=WGS84 +units=m +no_defs"
);

// Given a center point (lat, lng) and half-height and half-width in degrees, return the bounds
function getBoundsFromCenter(lat, lng, halfHeightDeg, halfWidthDeg) {
  return {
    north: lat + halfHeightDeg,
    south: lat - halfHeightDeg,
    east: lng + halfWidthDeg,
    west: lng - halfWidthDeg,
  };
}

async function initMap() {
  // Initialize the map
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: window.constants.map.defaultZoom,
    center: window.constants.map.centerUSA,
    draggableCursor: 'crosshair',
    fullscreenControl: false,
    styles: window.constants.map.defaultMapStyle,
  });

  // Load is Radar sites layer
  radarSitesLayer = new markerCollection(map);
  radarSitesLayer.reactClick = radarSiteClicked;
  await radarSitesLayer.init({
    marker_options: {
      markerFill: "red",
      markerStroke: "red",
      markerSize: 3.5
    }
  });
  loadRadarSites(radarSitesLayer);

  // Load in the USGS sites layer
  usgsSitesLayer = new markerCollection(map);
  usgsSitesLayer.reactClick = usgsSiteClicked;
  await usgsSitesLayer.init({
    marker_options: {
      markerFill: "green",
      markerStroke: "green",
      markerSize: 3.5
    }
  });

  loadPopData();

  const usgsSitesURL = window._env_dev.USGS_SITES_URL;
  loadUsgsSites(usgsSitesLayer, usgsSitesURL);

  // Load in population data for each USGS site
  loadUsgsPopulationMap();

  // Event handler when user clicks on a point in the map
  map.addListener("click", (e) => {
    // Do not allow user to click on map if a request is being processed
    if (isLoading) return;

    // Get the lat and lon coordinates of the point that was clicked (epsg:4326)
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Convert to epsg:3857
    const [x3857, y3857] = proj4('EPSG:4326', 'EPSG:3857', [lng, lat]);

    // Get AGL Threshold input
    const maxAlt = getInput(document.getElementById("aglThreshold-input"));
    // Get tower height input
    const towerHeight = getInput(document.getElementById("towerHeight-input"));

    // If the user entered an invalid input, return and do not send radar request
    if (document.getElementById("aglThreshold-input").value && maxAlt === null) return;
    if (document.getElementById("towerHeight-input").value && towerHeight === null) return;

    // Send request to backend
    sendRadarRequest(x3857, y3857, maxAlt, towerHeight);
  });
}

// Send a request to the backend to calculate radar coverage
async function sendRadarRequest(easting, northing, maxAlt = null, towerHeight = null) {
  try {
    isLoading = true;
    showSpinner();

    const beamModel = document.getElementById("beamModel-input").value;

    const payload = {
      easting: easting,
      northing: northing,
    };

    const unitSystem = document.getElementById("units-input").value;
    const metersToFeet = (m) => m * 3.28084;
    const feetToMeters = (m) => m / 3.28084;

    if (maxAlt !== null) {
      if (unitSystem == "metric") {
        payload.max_alt_m = maxAlt;
      } else {
        payload.max_alt_m = feetToMeters(maxAlt);
      }
    }

    if (towerHeight !== null) {
      if (unitSystem == "metric") {
        payload.tower_m = towerHeight;
      } else {
        payload.tower_m = feetToMeters(towerHeight);
      }
    }
  
    const angles = getCheckedElevationAngles();
    if (angles.length > 0) payload.elevation_angles = angles;

    const response = await fetch(`${server}/calculate_blockage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Radar coverage request failed.");
    }

    
    const blob = await response.blob();
    console.log(blob);
    const imageUrl = URL.createObjectURL(blob);

    const halfExtent = window.constants.radar.halfExtent;

    const bounds3857 = {
      west: easting - halfExtent,
      east: easting + halfExtent,
      south: northing - halfExtent,
      north: northing + halfExtent
    };
    const [westLng, southLat] = proj4('EPSG:3857', 'EPSG:4326', [bounds3857.west, bounds3857.south]);
    const [eastLng, northLat] = proj4('EPSG:3857', 'EPSG:4326', [bounds3857.east, bounds3857.north]);

    const overlayBounds = {
      north: northLat,
      south: southLat,
      east: eastLng,
      west: westLng,
    };

    const overlay = new google.maps.GroundOverlay(imageUrl, overlayBounds, { 
      opacity: 0.7,
      clickable: false,
    });
    overlay.setMap(map);
  }
  catch (err) {
    console.log("Error fetching radar coverage: ", err);
  }
  finally {
    isLoading = false;
    hideSpinner();
  }
}

// Toggle the visibility of a sidebar window
function toggleWindow(id) {
  // Close other windows
  document.querySelectorAll('.sidebar-window').forEach(w => {
    if (w.id !== id) w.style.display = 'none';
  });

  const el = document.getElementById(id);
  el.style.display = (el.style.display === 'block') ? 'none' : 'block';
}

// Given an html input element, get the value
// Returns value if value is valid, null otherwise
function getInput(input) {
  // Get the value from the input element
  const value = parseFloat(input.value);
  // Verify the value
  if (value < 0) {
    alert("Please use non-negative values.");
    return null;
  }
  if (isNaN(value) || value < 0) {
    return null;
  }

  return value;
}

function showSpinner() {
  document.getElementById("loading-spinner").style.display = "block";
}

function hideSpinner() {
  document.getElementById("loading-spinner").style.display = "none";
}

// Returns a list of checked elevation angles
function getCheckedElevationAngles() {
  const checkboxes = document.querySelectorAll('#elevation-angle-checkboxes input[type="checkbox"]');
  return Array.from(checkboxes)
              .filter(cb => cb.checked)
              .map(cb => parseFloat(cb.value));
}

document.getElementById("usgsSites-checkbox").addEventListener("change", function () {
  if (this.checked) {
    usgsSitesLayer.show();
  } else {
    usgsSitesLayer.hide();
  }
});

function getArrayBuffer(url) {
    return fetch(url).then(response => response.arrayBuffer());
}

// Load USGS sites from a GeoJSON PBF file
function loadUsgsSites(target, src) {
    getArrayBuffer(src).then((ret) => {
        const pbf = new Pbf(ret);
        const geojson = geobuf.decode(pbf);  // Converts to GeoJSON

        for (let i = 0; i < geojson.features.length; i++) {
            const f = geojson.features[i];
            const c = f.geometry.coordinates;

            // Skip small basins
            if (1 * f.properties.drainage_area < 100) continue;

            target.makeMarker(
                c[1], // latitude
                c[0], // longitude
                {
                    properties: f.properties,
                    clickable: true,
                    optimized: true
                },
                {
                    clickable: true,
                    mouseOver: false,
                    mouseOut: false
                }
            );
        }
        target.hide(); // Do not show initially
    });
}

// Load the USGS population map with maps of USGS site IDs to population counts
function loadUsgsPopulationMap() {
  fetch('public/data/usgs_population_map.json')
    .then(res => res.json())
    .then(data => {
      usgsPopulationMap = data;
    })
    .catch(err => console.error('Error loading population map:', err));
}

// Event handler for when a USGS site marker is clicked
// Displays a label with the USGS site ID, drainage area, and population and loads the basin boundary
function usgsSiteClicked(event, marker) {
  const props = marker.properties || marker.content?.dataset || {};
  const usgsId = props.usgs_id;
  const area = props.drainage_area;
  const population = usgsPopulationMap?.[usgsId] ?? null;
  showLabel(marker, usgsId, area, population);
  loadBasin(usgsId);
}

// Load the basin boundary for a given USGS site ID
async function loadBasin(usgsId) {
  // If this basin is already displayed, do nothing
  if (usgsBasinLayers[usgsId]) {
    return;
  }

  // Otherwise, fetch and show it
  try {
    const buf = await getArrayBuffer(`${window._env_dev.USGS_BOUNDARY_URL}${usgsId}.pbf`);
    const geojson = geobuf.decode(new Pbf(new Uint8Array(buf)));

    const layer = new google.maps.Data({ map });
    layer.addGeoJson(geojson);
    layer.setStyle({
      fillColor: "white",
      fillOpacity: 0.0,
      strokeColor: "black",
      strokeWeight: 1,
    });

    usgsBasinLayers[usgsId] = layer;
  } catch (err) {
    console.error("Error loading basin:", err);
  }
}

// Create a label element with the site ID, area, and optional population
function createLabel(site_id, area, population = null, use_class = 'arrow_rht_box') {
    const div = document.createElement('div');
    div.classList.add(use_class);
    div.setAttribute('style', 'position:absolute; will-change: left, top;');

    let html = `${site_id}<br>Area: ${area.toFixed(1)} km²`;
    if (population !== null) {
        html += `<br>Population: ${population.toLocaleString()}`;
    }

    div.innerHTML = html;
    return div;
}

// Show a label for a marker with the site ID, area, and optional population
function showLabel(marker, site_id, area, population = null) {
    if (marker.customLabel && marker.customLabel.remove) {
        return;
    }
    const labelDiv = createLabel(site_id, area, population, 'arrow_rht_box');
    const label = new infoTool(marker.getMap(), marker.getPosition(), labelDiv);
    marker.customLabel = label;
}

// Updates labels in radar settings menu based on selected units
document.getElementById("units-input").addEventListener("change", function () {
  const unit = this.value;
  
  const aglLabel = document.querySelector("label[for='aglThreshold-input']");
  const towerLabel = document.querySelector("label[for='towerHeight-input']");
  const aglInput = document.getElementById("aglThreshold-input");
  const towerInput = document.getElementById("towerHeight-input");

  if (unit === "metric") {
    aglLabel.textContent = "AGL Threshold (m):";
    towerLabel.textContent = "Tower Height (m):";
    aglInput.placeholder = "e.g. 914.4";
    towerInput.placeholder = "e.g. 30.48";
  } else {
    aglLabel.textContent = "AGL Threshold (ft):";
    towerLabel.textContent = "Tower Height (ft):";
    aglInput.placeholder = "e.g. 3000";
    towerInput.placeholder = "e.g. 100";
  }
});

/* POD */

// Holds the current POD parameters
const podSettings = {
  year:    null,
  season:  'All',
  stops:   32,
  vmin:    0,
  vmax:    50,
  palette: 'Spectral',
  opacity: 1.0
};

// Create range slider for POD layer
const podRangeSlider = document.getElementById('pod-range-slider');

noUiSlider.create(podRangeSlider, {
  start: [podSettings.vmin, podSettings.vmax],
  connect: true,
  range: { min: 0, max: 100 },
  tooltips: [true, true],
  format: {
    to:   v => Math.round(v),
    from: v => Number(v)
  }
});

let di = null;
let podOverlay = null;
let currentURL = null;

// Given year and season, return start and end date for that season in that year
function getSeasonDates(year, season) {
  let start, end;
  switch (season) {
    case 'Winter': start = new Date(year,0,1);  end = new Date(year,2,31); break;
    case 'Spring': start = new Date(year,3,1);  end = new Date(year,5,30); break;
    case 'Summer': start = new Date(year,6,1);  end = new Date(year,8,30); break;
    case 'Fall':   start = new Date(year,9,1);  end = new Date(year,11,31); break;
    default:       start = new Date(year,0,1);  end = new Date(year,11,31);
  }
  return { start, end };
}

async function fetchAndDrawPOD() {
  showSpinner(); isLoading = true;
  const { start, end } = getSeasonDates(podSettings.year, podSettings.season);
  const url = new POD().getUrl(start, end);

  // If same URL, no need to fetch again
  if (url === currentURL && di) {
    isLoading = false;
    hideSpinner();
    return redrawStylingOnly();
  }
  currentURL = url;

  if (!di) {
    di = new dynaImg();
    di.image = new Image();
    di.image.crossOrigin = '';
  }

  applyPodStylingToDynaImg();

  const blob = await di.load(url);

  if (podOverlay) podOverlay.remove();
  podOverlay = customOverlay(blob, window.constants.pod.POD_BBOX, map, 'GroundOverlay');
  podOverlay.setOpacity(podSettings.opacity);

  isLoading = false; hideSpinner();
}

async function redrawStylingOnly() {
  if (!di) return;               // nothing loaded yet
  applyPodStylingToDynaImg();
  const blob = await di.redraw();
  if (podOverlay) podOverlay.setSource(blob);
}

function applyPodStylingToDynaImg() {
  di.setStops(podSettings.stops);
  di.setRange(podSettings.vmin / 100, podSettings.vmax / 100);
  di.setColors(podSettings.palette, window.constants.pod.POD_COLORS[podSettings.palette]);
}

document.getElementById('pod-year-select')
  .addEventListener('change', e => {
    const y = parseInt(e.target.value, 10);
    podSettings.year = isNaN(y) ? null : y;
    if (podSettings.year) {
      fetchAndDrawPOD();
    }
  });

  document.getElementById('pod-season-select')
  .addEventListener('change', e => {
    podSettings.season = e.target.value || 'All';
    if (podSettings.year) {
      fetchAndDrawPOD();
    }
  });


podRangeSlider.noUiSlider.on('update', vals => {
  podSettings.vmin = +vals[0];
  podSettings.vmax = +vals[1];
});
podRangeSlider.noUiSlider.on('set', redrawStylingOnly);

document.getElementById('pod-color-count')
  .addEventListener('change', e => {
    podSettings.stops = +e.target.value;
    redrawStylingOnly();
  });

document.querySelectorAll('input[name="palette"]')
  .forEach(r => r.addEventListener('change', e => {
    podSettings.palette = e.target.value.replace('-', '');
    redrawStylingOnly();
  }));

const opacitySlider = document.getElementById('pod-opacity');
const opacityLabel  = document.getElementById('pod-opacity-value');
opacitySlider.addEventListener('input', e => {
  const pct = +e.target.value;
  opacityLabel.textContent = `${pct}%`;
  podSettings.opacity = pct / 100;
  if (podOverlay) podOverlay.setOpacity(podSettings.opacity);
});

document.getElementById("clear-pod-layer").addEventListener('click', () => {
  podOverlay.remove();
})

/* Precalculated radar sites */
const radarCoverageOverlays = {}

function loadRadarSites(target) {
  fetch('public/data/nexrad_epsg3857.geojson')
  .then(response => response.json())
  .then(data => {
    for (let i = 0; i < data.features.length; i++) {
      const description = data.features[i].properties.description;
      const siteData = extractSiteData(description);
      const coords = {
        latitude: siteData.latitude,
        longitude: siteData.longitude,
      };

      target.makeMarker(
        coords.latitude,
        coords.longitude,
        {
          properties: {
            siteID : siteData.siteId,
            easting: data.features[i].geometry.coordinates[0],
            northing: data.features[i].geometry.coordinates[1],
            elevation: siteData.elevation,
          },
          clickable: true,
          optimized: true
        },
        {
          clickable: true,
          mouseOver: false,
          mouseOut: false
        }
      );
    }
  });
}

function extractSiteData(description) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(description, 'text/html');
  const tdElements = Array.from(doc.querySelectorAll('td'));

  let siteId = null;
  let latitude = null;
  let longitude = null;
  let elevation = null;

  tdElements.forEach(td => {
    const text = td.textContent.trim();

    if (text.startsWith("SITE ID")) {
      const match = text.match(/NEXRAD:([A-Z0-9]+)/);
      if (match) siteId = match[1];
    } else if (text.startsWith("LATITUDE")) {
      latitude = parseFloat(text.replace("LATITUDE", "").trim());
    } else if (text.startsWith("LONGITUDE")) {
      longitude = parseFloat(text.replace("LONGITUDE", "").trim());
    } else if (text.startsWith("ELEVATION")) {
      elevation = parseFloat(text.replace("ELEVATION", "").trim());
    }
  });

  return { siteId, latitude, longitude, elevation };
}


function radarSiteClicked(event, marker) {
  if (radarCoverageOverlays[marker.properties.siteID]) {
    // If overlay already exists for this site, remove it
    radarCoverageOverlays[marker.properties.siteID].setMap(null);
    delete radarCoverageOverlays[marker.properties.siteID];
    return;
  }

  const halfExtent = window.constants.radar.halfExtent;

  const bounds3857 = {
    west: marker.properties.easting - halfExtent,
    east: marker.properties.easting + halfExtent,
    south: marker.properties.northing - halfExtent,
    north: marker.properties.northing + halfExtent,
  };

  // Convert EPSG:3857 bounds to EPSG:4326
  const [westLng, southLat] = proj4('EPSG:3857', 'EPSG:4326', [bounds3857.west, bounds3857.south]);
  const [eastLng, northLat] = proj4('EPSG:3857', 'EPSG:4326', [bounds3857.east, bounds3857.north]);

  const overlayBounds = {
    north: northLat,
    south: southLat,
    east: eastLng,
    west: westLng,
  };

  const overlay = new google.maps.GroundOverlay(
    `/public/data/nexrad_coverages/coverages_3k/${marker.properties.siteID}.png`,
    overlayBounds,
    {
       opacity: 0.7,
        clickable: false,
    }
  );
  overlay.setMap(map);
  radarCoverageOverlays[marker.properties.siteID] = overlay;
}

const radarSiteCheckbox = document.getElementById("radarSite-checkbox");
radarSiteCheckbox.addEventListener('click', () => {
  if (radarSiteCheckbox.checked) {
    radarSitesLayer.show();
  } else {
    for (const siteId in radarCoverageOverlays) {
      const overlay = radarCoverageOverlays[siteId];
      overlay.setMap(null);
      delete radarCoverageOverlays[siteId];
    }
    radarSitesLayer.hide();
  }
});

/* Population Threshold Raster */
document.getElementById("popThreshold-slider").addEventListener('input', e => {
  const threshold = +e.target.value;
  document.getElementById("popThreshold-value").textContent = threshold.toLocaleString();
  canvas.style.display = 'block';
  drawRaster(canvas, popData, threshold);
});

let popData = [];
let popData_bounds;
let threshold = 0;
const canvas = document.getElementById("pop-canvas");

function loadPopData() {
  fetch("public/data/usa_ppp_2020_5k_epsg_3857.json")
  .then(res => res.json())
  .then(json => {
    popData = json.data;
    popData_bounds = json.bounds;

    const transformer = proj4("EPSG:3857", "EPSG:4326");
    const [west, south] = transformer.forward([popData_bounds[0], popData_bounds[1]]);
    const [east, north] = transformer.forward([popData_bounds[2], popData_bounds[3]]);

    canvas.width = popData[0].length;
    canvas.height = popData.length;

    const overlayBounds = { north, south, east, west };
    const overlay = new CanvasOverlay(overlayBounds, canvas);
    overlay.setMap(map);
  });
}

function drawRaster(canvas, data, threshold) {
  const ctx = canvas.getContext("2d");
  const width = data[0].length;
  const height = data.length;

  const imageData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value = data[y][x];
      if (value > threshold) {
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = 255;
        imageData.data[idx + 3] = 255;
      } else {
        imageData.data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

document.getElementById("clear-pop-layer").addEventListener('click', () => {
  canvas.style.display = 'none';
});