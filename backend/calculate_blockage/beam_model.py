import numpy as np

EARTH_RADIUS = 6_371_000  # meters
K0 = 1 / (4 * EARTH_RADIUS)  # standard curvature

def slant_range(ground_range: np.ndarray, ea_rad: float) -> np.ndarray:
    """
    Compute slant range r from ground range s using Eq. (A7)
    from Davies-Jones et al. (2019), real Earth model with refraction.
    
    Parameters:
    - s: ground range(s), in meters (can be n-dimensional)
    - ea_rad: elevation angle in radians (scalar)
    
    Returns:
    - r: slant range(s), in meters (same shape as s)
    """
    ground_range = np.asarray(ground_range, dtype=np.float64)
    a = EARTH_RADIUS
    kappa = K0 * np.cos(ea_rad)

    s_a = ground_range / a
    inner = a * kappa * np.sin(s_a) - np.sin(ea_rad + s_a)
    r = (1 / kappa) * (ea_rad + s_a + np.arcsin(inner))

    return r

def beam_height_4_3(slant_range: np.ndarray, ea_rad: float) -> np.ndarray:
    """
    Accurate radar beam height above Earth's surface using Eq. (41) from the paper,
    with corrected S and H from Eqs. (38) and (39).

    Parameters:
    - r: slant range(s) in meters (can be nD array)
    - ea_rad: elevation angle in radians (scalar)

    Returns:
    - z: beam height(s) in meters (same shape as r)
    """
    slant_range = np.asarray(slant_range, dtype=np.float64)
    a = EARTH_RADIUS
    kappa = K0 * np.cos(ea_rad)

    kr = kappa * slant_range
    sin_kr = np.sin(kr)
    one_minus_cos_kr = 1 - np.cos(kr)

    S = (sin_kr / kappa) * np.cos(ea_rad) + (one_minus_cos_kr / kappa) * np.sin(ea_rad)
    H = (sin_kr / kappa) * np.sin(ea_rad) - (one_minus_cos_kr / kappa) * np.cos(ea_rad)

    z = np.sqrt((a + H)**2 + S**2) - a
    return z