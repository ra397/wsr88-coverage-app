from processor import get_blockage
import json
from calculate_blockage.read_dem import DemReader
from calculate_blockage.constants import DEM_PATH

def feet_to_meters(feet):
  meters = feet * 0.3048
  return meters

def extract_radar_info(feature):
    # Get easting and northing
    easting, northing = feature["geometry"]["coordinates"]

    # Get description string
    desc = feature["properties"]["description"]

    # Helper function to find a value after a keyword
    def extract_value(keyword):
        for line in desc.split("<td>"):
            if keyword in line:
                value = line.split(keyword)[-1]
                value = value.split("</td>")[0].strip()
                return value
        return None

    # Extract values
    site_id_line = extract_value("SITE ID NEXRAD:")
    site_id = site_id_line if site_id_line else None

    elevation_str = extract_value("ELEVATION")
    elevation = float(elevation_str) if elevation_str else None

    return {
        "easting": easting,
        "northing": northing,
        "site_id": site_id,
        "elevation_ft": elevation
    }


with open("nexrad_epsg3857.geojson", "r") as f:
    data = json.load(f)

    for feature in data["features"]:
        radar_info = extract_radar_info(feature)

        if radar_info["site_id"] is None:
            print(f"Skipping feature with missing SITE ID: {feature}")
            continue

        dem_reader = DemReader(DEM_PATH)
        window = dem_reader.window(
            easting=radar_info["easting"],
            northing=radar_info["northing"],
            window_size=3  # 3x3 window for DEM
        )
        terrain_elevation = window[1, 1]  # Center pixel elevation
        dem_reader.close()

        tower_m = feet_to_meters(radar_info["elevation_ft"]) - terrain_elevation

        # Get blockage for the radar
        img_buf = get_blockage(
            easting=radar_info["easting"],
            northing=radar_info["northing"],
            tower_m=tower_m,
        )

        print(f"Processing radar: {radar_info['site_id']} with tower height {tower_m:.2f} m")

        with open(f"coverages_3k/{radar_info['site_id']}.png", "wb") as f:
            f.write(img_buf.getbuffer())