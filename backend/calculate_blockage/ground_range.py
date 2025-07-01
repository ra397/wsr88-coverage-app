import numpy as np

def ground_range_grid(grid_size: int, pixel_resolution: int) -> np.ndarray:
    center = (grid_size - 1) / 2.0

    x = np.arange(grid_size)
    y = np.arange(grid_size)
    xx, yy = np.meshgrid(x, y)

    dx = xx - center
    dy = yy - center

    distances = np.sqrt(dx**2 + dy**2) * pixel_resolution
    return distances.astype(np.uint32)