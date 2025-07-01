import time
import rasterio
import numpy as np
from geojson import Point, Feature, FeatureCollection
import json
import os

raster_path = os.path.join(os.path.dirname(__file__), "usa_ppp_2020_5km_Aggregated.tif")

def calculate_pop_points(population_threshold: int):
    with rasterio.open(raster_path) as src:
        data = src.read(1)
        transform = src.transform
        height, width = data.shape

        # Flatten the raster
        data_flat = data.ravel()

        # Get indices where condition is met
        valid_idxs = np.flatnonzero(data_flat > population_threshold)

        # Convert 1D indices to 2D (row, col)
        rows = valid_idxs // width
        cols = valid_idxs % width

        # Compute pixel centers
        xs, ys = rasterio.transform.xy(transform, rows, cols, offset='center')

        # Build GeoJSON features
        features = [Feature(geometry=Point((x, y))) for x, y in zip(xs, ys)]

        # Output
        return FeatureCollection(features)