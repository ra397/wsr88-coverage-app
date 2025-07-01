from osgeo import gdal
import numpy as np

class DemReader:
    def __init__(self, dem_path):
        self.ds = gdal.Open(dem_path)
        gt = self.ds.GetGeoTransform()
        self.inv_gt = gdal.InvGeoTransform(gt)
        self.band = self.ds.GetRasterBand(1)
        self.width = self.ds.RasterXSize
        self.height = self.ds.RasterYSize

    def window(self, easting, northing, window_size):
        px, py = gdal.ApplyGeoTransform(self.inv_gt, easting, northing)
        origin_x = int(round(px))
        origin_y = int(round(py))

        top_left_x = origin_x - (window_size // 2)
        top_left_y = origin_y - (window_size // 2)

        # Calculate window bounds within DEM
        x_off = max(top_left_x, 0)
        y_off = max(top_left_y, 0)
        x_end = min(top_left_x + window_size, self.width)
        y_end = min(top_left_y + window_size, self.height)

        # How much of the window is valid DEM data
        valid_w = x_end - x_off
        valid_h = y_end - y_off

        # Allocate output, fill with zeros
        window = np.zeros((window_size, window_size), dtype=np.int16)

        # If there is any overlap, fill in data
        if valid_w > 0 and valid_h > 0:
            arr = self.band.ReadAsArray(x_off, y_off, valid_w, valid_h) # type: ignore
            # Compute where to place it in output window
            dest_x = x_off - top_left_x
            dest_y = y_off - top_left_y
            window[dest_y:dest_y+valid_h, dest_x:dest_x+valid_w] = arr

        window = np.flipud(window)
        return window

    def close(self):
        self.ds = None
        self.inv_gt = None
        self.band = None