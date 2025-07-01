from flask import Flask, request, make_response, jsonify, send_file
from processor import get_blockage
from population.calculate_pop_points import calculate_pop_points
import traceback
import io
import httpx
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={
    r"/api-wsr88/*": {
        "origins": [
            "https://s-iihr80.iihr.uiowa.edu",
            "http://localhost:5500"
        ]
    }
})

@app.route("/api-wsr88/ping", methods=['GET'])
def api_root():
    return 'pong'

@app.route("/api-wsr88/calculate_blockage", methods=["POST"])
def calculate_blockage():
    try:
        data = request.get_json()
        easting = data.get("easting")
        northing = data.get("northing")
        tower_m = data.get("tower_m")
        max_alt_m = data.get("max_alt_m")
        elevation_angles = data.get("elevation_angles")

        print("Request received:", data)

        img_buf = get_blockage(
            easting=easting,
            northing=northing,
            elevation_angles_deg=elevation_angles,
            tower_m=tower_m,
            agl_threshold_m=max_alt_m,
        )
        img_buf.seek(0)
        return send_file(img_buf, mimetype="image/png")

    except Exception as e:
        traceback.print_exc()
        return jsonify({"detail": str(e)}), 500

@app.route("/api-wsr88/population_points", methods=["POST"])
def get_population_points():
    try:
        body = request.get_json()
        threshold = body.get("population_threshold")

        if threshold is None or not (0 <= threshold <= 100000):
            return jsonify({"detail": "Invalid population threshold"}), 400

        geojson_result = calculate_pop_points(population_threshold=threshold)
        return jsonify(geojson_result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"detail": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)