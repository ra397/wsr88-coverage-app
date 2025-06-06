let map;

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

function initMap() {
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

  // Event handler when user clicks on a point in the map
  map.addListener("click", (e) => {
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

    console.log("Request sent: ", payload);

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