import numpy as np
from .read_dem import DemReader
from .ground_range import ground_range_grid
from .beam_model import slant_range, beam_height_4_3
from .constants import BEAM_CACHE
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_beam(ea_deg, window_size, pixel_resolution):
    if ea_deg in BEAM_CACHE:
        return BEAM_CACHE[ea_deg]
    adjusted_ea_deg = ea_deg - (.9/2)
    ea_rad = np.deg2rad(adjusted_ea_deg)
    ground_ranges = ground_range_grid(window_size, pixel_resolution)
    slant_ranges = slant_range(ground_ranges, ea_rad)
    beam = beam_height_4_3(slant_ranges, ea_rad)
    return beam

def calculate_blockage(elevation, ea_deg, tower_height, agl_threshold, window_size, pixel_res):
    beam = get_beam(ea_deg, window_size, pixel_res)
    mid = elevation.shape[0] // 2
    tower_elev = elevation[mid, mid]
    asl = beam + tower_elev + tower_height
    mask = (asl > elevation) & ((asl - elevation) < agl_threshold)
    return mask.astype(np.uint8)

def combine_blockage_masks(dem_path, easting, northing,
                           elevation_angles, tower_height, agl_threshold,
                           window_size=5112, pixel_res=90):
    dem_reader = DemReader(dem_path)
    elevation = dem_reader.window(easting, northing, window_size)
    dem_reader.close()

    # helper that gets coverage per ea
    def _mask_for_ea(ea):
        return calculate_blockage(elevation, ea, tower_height, agl_threshold, window_size, pixel_res)

    combined = np.zeros((window_size, window_size), dtype=np.uint8)
    with ThreadPoolExecutor(max_workers=min(len(elevation_angles), 8)) as executor:
        futures = {executor.submit(_mask_for_ea, ea): ea for ea in elevation_angles}
        for fut in as_completed(futures):
            combined |= fut.result()
    return combined