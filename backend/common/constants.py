def m2ft(m):
    return m/0.0254/12

def ft2m(ft):
    return ft*12*0.0254

QRTS = ['ne', 'nw', 'sw', 'se']
VCP12 = [
    0.5,
    0.9,
    1.3,
    1.8,
    2.4,
    3.1,
    4.0,
    5.1,
    6.4,
    8.0,
    10.0,
    12.5,
    15.6,
    19.5,
]

EARTH_RADIUS = 6.371e6                  # ....the standard refraction formula used by the Open Radar Product Generator of the WSR-88D (NEXRAD)
EFF_RADIUS = 1.21 * EARTH_RADIUS        # accounts for the standard index of refraction
# kZ = 1/(5.76*EARTH_RADIUS)
kZ = .21/1.21/EARTH_RADIUS              # <- 1/EFF_RADIUS = -kZ + 1/EARTH_RADIUS



# QUARTER_W, QUARTER_H = 306, 306
MAX_RAY_ALT_FT = 3e3
MAX_RAY_ALT = ft2m(MAX_RAY_ALT_FT)
MAX, STEP  = 230e3, 90

QUARTER_W, QUARTER_H = int(MAX/STEP), int(MAX/STEP)

RADAR_NPZ = r"radar_beam_90m_0.20deg_1.33.npz"
DEM = r"_dem090.tif" # 90m DEM
WSR_SRC = r"nexrad_epsg5070.geojson" # NEXRAD locations data

EPSG = 5070