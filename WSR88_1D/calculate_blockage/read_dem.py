from osgeo import gdal
import numpy as np

class DemReader:
    def __init__(self, dem_path):
        self.ds = gdal.Open(dem_path)
        gt = self.ds.GetGeoTransform()
        self.inv_gt = gdal.InvGeoTransform(gt)
        self.band = self.ds.GetRasterBand(1)

    def window(self, easting, northing, window_size):
        px, py = gdal.ApplyGeoTransform(self.inv_gt, easting, northing)
        origin_x = int(round(px))
        origin_y = int(round(py))

        top_left_x = origin_x - (window_size // 2)
        top_left_y = origin_y - (window_size // 2)

        window = self.band.ReadAsArray(top_left_x, top_left_y, window_size, window_size).astype(np.int16) # type: ignore

        window = np.flipud(window)

        return window
    
    def close(self):
        self.ds = None
        self.inv_gt = None
        self.band = None