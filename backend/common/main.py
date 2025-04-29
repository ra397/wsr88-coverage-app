from osgeo import gdal, osr
from common import constants as const
from matplotlib import pyplot as plt
import numpy as np
from skimage import measure
from shapely.geometry import Polygon, mapping
import json
import rasterio

def read_dem_value(dem_path, easting, northing):
    """
    dem_path: Path to DEM file (e.g., GeoTIFF)
    easting, northing: coordinates in DEM's CRS (example: EPSG:5070)

    Returns the value from Band 1 at that location.
    """
    with rasterio.open(dem_path) as src:
        # Convert (easting, northing) to (row, col)
        row, col = src.index(easting, northing)

        # Read 1x1 window
        window = rasterio.windows.Window(col_off=col, row_off=row, width=1, height=1)
        value = src.read(1, window=window)[0, 0]

    return value

def find_furthest_unblocked(angle_grid, blockage_grid, distances_grid):
    rows, cols = angle_grid.shape

    # Prepare output
    output = np.zeros_like(angle_grid, dtype=np.uint8)

    # Get flattened arrays
    flat_angles = angle_grid.flatten()
    flat_blockage = blockage_grid.flatten()
    flat_distances = distances_grid.flatten()

    # Work only on unblocked cells
    valid_mask = flat_blockage != 0
    valid_angles = flat_angles[valid_mask]
    valid_distances = flat_distances[valid_mask]
    valid_indices = np.nonzero(valid_mask)[0]

    # Now: for each angle from 0 to 359, find the max distance cell
    for angle in np.unique(flat_angles):
        # Find where (valid_angles == angle)
        angle_mask = valid_angles == angle
        if not np.any(angle_mask):
            continue  # No unblocked cells at this angle

        angle_distances = valid_distances[angle_mask]
        angle_indices = valid_indices[angle_mask]

        # Find the one with maximum distance
        max_idx_in_angle = angle_indices[np.argmax(angle_distances)]

        # Mark it in the output
        row, col = divmod(max_idx_in_angle, cols)
        output[row, col] = 1

    return output

def get_epsg5070_coordinates_ordered_by_angle(output_grid, angle_grid, center_x, center_y, center_row, center_col, cell_size=90):
    """
    output_grid: 2D numpy array where 1 marks selected cells
    angle_grid, blockage_grid, distances_grid: original full grids
    center_x, center_y: EPSG:5070 coordinates of center cell
    center_row, center_col: center cell index
    """
    rows, cols = np.where(output_grid == 1)

    # Get angles of the selected points
    selected_angles = angle_grid[rows, cols]
    
    # Get real-world coordinates
    x_coords = center_x + (cols - center_col) * cell_size
    y_coords = center_y - (rows - center_row) * cell_size

    coords = np.stack((x_coords, y_coords), axis=1)

    # Sort by angle
    sort_idx = np.argsort(selected_angles)
    coords_sorted = coords[sort_idx]

    # Close the polygon
    coords_closed = np.vstack([coords_sorted, coords_sorted[0]])

    return coords_closed

def coords_to_polygon_geojson(coords, epsg_code=5070):
    """
    coords: (N+1, 2) closed coordinates
    """
    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords.tolist()]  # one outer ring
            },
            "properties": {}
        }],
        "crs": {
            "type": "name",
            "properties": {
                "name": f"EPSG:{epsg_code}"
            }
        }
    }
    
    return geojson

def makeGTiff(fn, data, left, top, x_cell, y_cell, epsg=const.EPSG, bands=1, type = gdal.GDT_Float32):
    if not y_cell: y_cell = x_cell
    rows, cols = data.shape
    driver = gdal.GetDriverByName('GTiff')
    dataset = driver.Create(fn, cols, rows, bands, type)
    # geotransform = (left, x_cell, 0, top, 0, y_cell)
    dataset.SetGeoTransform((left, x_cell, 0, top, 0, y_cell))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)
    dataset.SetProjection(srs.ExportToWkt())
    band = dataset.GetRasterBand(1)
    band.WriteArray(data)
    band.FlushCache()
    dataset = None

def getRasterGt(path=None):
    if path is None:
        path = const.DEM
    dataset = gdal.Open(path)
    gt = dataset.GetGeoTransform()
    dataset = None
    return gt

def plotData(data, cmap='viridis'):
    h, w = data.shape
    fig, ax = plt.subplots(
        figsize=(
            abs(w)/100,
            abs(h)/100
        ),
        dpi=100
    )
    ax.imshow(data, cmap=cmap)
    ax.axis('off')
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.show()

def putTogether(result):
    h, w = result['ne'].shape
    canvas = np.zeros((2*h-1, 2*w-1))
    canvas[0:h, 0:w] = result['sw']
    canvas[0:h, w-1:] = result['se']
    canvas[h-1:, 0:w] = result['nw']
    canvas[h - 1:, w-1:] = result['ne']
    return canvas

def plotTogether(result):
    h, w = result[const.QRTS[0]].shape
    canvas = np.zeros((2*h-1, 2*w-1))
    canvas[0:h, 0:w] = result['sw']
    canvas[0:h, w-1:] = result['se']
    canvas[h-1:, 0:w] = result['nw']
    canvas[h - 1:, w-1:] = result['ne']
    h, w = canvas.shape
    fig, ax = plt.subplots(
        figsize=(
            abs(w) / 100,
            abs(h) / 100
        ),
        dpi=100
    )
    ax.imshow(canvas, cmap='viridis')
    ax.axis('off')
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.show()