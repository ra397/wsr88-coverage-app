from osgeo import gdal, osr
from common import constants as const
from matplotlib import pyplot as plt
import numpy as np
from matplotlib.colors import ListedColormap
from io import BytesIO
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

def makePNG(coverage_matrix):
    coverage_matrix = np.flipud(coverage_matrix)
    coverage_matrix = (coverage_matrix > 0).astype(np.uint8)

    color = [1.0, 0.0, 0.0, 0.7]  # red with 0.7 opacity
    transparent = [0.0, 0.0, 0.0, 0.0]  # fully transparent

    fig, ax = plt.subplots(figsize=(51.09, 51.09), dpi=100)  # 51.09 * 100 = 5109 pixels
    ax.axis("off")
    ax.imshow(coverage_matrix, cmap=ListedColormap([transparent, color]), interpolation="nearest")

    buf = BytesIO()
    plt.savefig(buf, format="png", dpi=100, transparent=True)
    plt.close(fig)
    buf.seek(0)

    return buf


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
    canvas = np.zeros((2*h-1, 2*w-1), dtype=result['ne'].dtype)
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