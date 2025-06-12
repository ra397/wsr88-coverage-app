let map;

let usgsSitesLayer;
const usgsBasinLayers = {}; // Each basin boundary is its own Data layer

let isLoading = false;

// Define EPSG:5070 (NAD83 / CONUS Albers Equal Area)
proj4.defs(
  "EPSG:5070",
  "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 " +
  "+lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs"
);

function getBoundsFromCenter(lat, lng, halfHeightDeg, halfWidthDeg) {
  return {
    north: lat + halfHeightDeg,
    south: lat - halfHeightDeg,
    east: lng + halfWidthDeg,
    west: lng - halfWidthDeg,
  };
}

async function initMap() {
  const centerUSA = { lat: 39.5, lng: -98.35 };

  // Initialize the map
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 5,
    center: centerUSA,
    draggableCursor: 'crosshair',
    fullscreenControl: false,
    styles: [
      {
        featureType: 'administrative',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  });

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
  const usgsSitesURL = "https://ifis.iowafloodcenter.org/ciroh/assets/uid_markers.pbf";
  loadUsgsSites(usgsSitesLayer, usgsSitesURL);

  // Event handler when user clicks on a point in the map
  map.addListener("click", (e) => {
    // Do not allow user to click on map if a request is being processed
    if (isLoading) return;

    // Get the lat and lon coordinates of the point that was clicked
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Convert to epsg:5070 
    const [x5070, y5070] = proj4('EPSG:4326', 'EPSG:5070', [lng, lat]);

    // Get AGL Threshold input
    const maxAlt = getInput(document.getElementById("aglThreshold-input"));
    // Get tower height input
    const towerHeight = getInput(document.getElementById("towerHeight-input"));

    // If the user entered an invalid input, return and do not send radar request
    if (document.getElementById("aglThreshold-input").value && maxAlt === null) return;
    if (document.getElementById("towerHeight-input").value && towerHeight === null) return;

    // Send request to backend
    sendRadarRequest(x5070, y5070, maxAlt, towerHeight);
  });
}

async function sendRadarRequest(easting, northing, maxAlt = null, towerHeight = null) {
  try {
    isLoading = true;
    showSpinner();

    const beamModel = document.getElementById("beamModel-input").value;

    const payload = {
      easting: easting,
      northing: northing,
      beam_model: beamModel,
    };

    if (maxAlt !== null) {
      payload.max_alt = maxAlt;
    }

    if (towerHeight !== null) {
      payload.tower_ft = towerHeight;
    }

    const angles = getCheckedElevationAngles();
    if (angles.length > 0) payload.elevation_angles = angles;

    const response = await fetch("http://localhost:8000/calculate_blockage", {
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
    const imageUrl = URL.createObjectURL(blob);

    // Image metadata
    const pixelSize = 90;         // meters per pixel
    const matrixSize = 5109;      // pixels
    const halfExtent = (pixelSize * matrixSize) / 2;  // = 229905 meters

    // EPSG:5070 bounds
    const bounds5070 = {
      west: easting - halfExtent,
      east: easting + halfExtent,
      south: northing - halfExtent,
      north: northing + halfExtent,
    };

    // Convert EPSG:5070 bounds to EPSG:4326
    const [westLng, southLat] = proj4('EPSG:5070', 'EPSG:4326', [bounds5070.west, bounds5070.south]);
    const [eastLng, northLat] = proj4('EPSG:5070', 'EPSG:4326', [bounds5070.east, bounds5070.north]);

    const overlayBounds = {
      north: northLat,
      south: southLat,
      east: eastLng,
      west: westLng,
    };

    // Add image as a GroundOverlay
    const overlay = new google.maps.GroundOverlay(
      imageUrl,
      overlayBounds,
      { opacity: 0.7 }
    );
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

document.getElementById("popThreshold-submit").addEventListener("click", async function () {
  isLoading = true;
  showSpinner();

  const input = document.getElementById("popThreshold-input");
  const value = parseInt(input.value, 10);

  if (isNaN(value) || value < 0 || value > 100000) {
    alert("Please enter a population threshold between 0 and 100,000.");
    return;
  }

  try {
    const response = await fetch("http://localhost:8000/population_points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ population_threshold: value }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch population points.");
    }

    const geojson = await response.json();

    if (window.populationLayer) {
      window.populationLayer.hide();
    }

    const populationLayer = new markerCollection(map);

    await populationLayer.init({
      marker_options: {
        markerFill: "red",
        markerStroke: "red",
        markerSize: 3.5
      }
    });

    geojson.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      populationLayer.makeMarker(lat, lng);
    });

    window.populationLayer = populationLayer;
    window.populationLayer.show();

  } catch (err) {
    console.error("Error fetching population points:", err);
  }
  finally {
    isLoading = false;
    hideSpinner();
  }
});

document.getElementById("popThreshold-clear").addEventListener("click", function () {
  if (window.populationLayer) {
    window.populationLayer.hide();
  }
  document.getElementById("popThreshold-input").value = "";
})

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

function usgsSiteClicked(event, marker) {
  const props = marker.properties || marker.content?.dataset || {};
  const usgsId = props.usgs_id;
  const area = props.drainage_area;
  showLabel(marker, usgsId, area);
  loadBasin(usgsId);
}

async function loadBasin(usgsId) {
  // If this basin is already displayed, do nothing
  if (usgsBasinLayers[usgsId]) {
    return;
  }

  // Otherwise, fetch and show it
  try {
    const buf = await getArrayBuffer(`http://localhost:8000/get_basin_boundary/${usgsId}`);
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

function createLabel(site_id, area, use_class = 'arrow_rht_box') {
    const div = document.createElement('div');
    div.classList.add(use_class);
    div.setAttribute('style', 'position:absolute; will-change: left, top;');
    div.innerHTML = `${site_id}<br>Area: ${area.toFixed(1)} km²`;
    return div;
}

function showLabel(marker, site_id, area) {
    // If label is already showing, do nothing
    if (marker.customLabel && marker.customLabel.remove) {
        return;
    }
    const labelDiv = createLabel(site_id, area, 'arrow_rht_box');
    const label = new infoTool(marker.getMap(), marker.getPosition(), labelDiv);
    marker.customLabel = label;
}