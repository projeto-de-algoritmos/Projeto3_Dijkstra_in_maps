
from routing.util import path_len
from routing.bidirectional import BidirectionalAStarAnimator
from routing.astar import AStarAnimator
import os
import sys
import json
from flask import Flask, make_response, request
from flask_gzip import Gzip
from time import time

app = Flask(__name__)
gzip = Gzip(app, compress_level=9)
if "test" in sys.argv:
    app.debug = True
# sys.path.append("routing/")

with open("routing/graph_data/brasilia.j") as fp:
    graph = json.loads(fp.read())
with open("routing/graph_data/brasilia_coords.j") as fp:
    graph_coords = json.loads(fp.read())
with open("routing/graph_data/lm_dists.j") as fp:
    lm_dists = json.loads(fp.read())

BIDIRECTION = BidirectionalAStarAnimator(graph, graph_coords, lm_dists)
ANIMATOR = AStarAnimator(graph, graph_coords, lm_dists)


@app.route("/favicon.ico")
def get_favicon():
    return open("static/favicon.ico", "r").read()


@app.route("/animation")
def search_animation():
    search_type = request.args.get("type")
    source = split_comma_ll(request.args.get("source"))
    dest = split_comma_ll(request.args.get("dest"))
    try:
        epsilon = float(request.args.get("epsilon", 1))
        epsilon = epsilon if epsilon >= 0 else 1
    except ValueError:
        epsilon = 1
    heuristic = request.args.get("heuristic", "manhattan")

    start = time()
    animator = ANIMATOR
    if request.args.get("bidirectional") == "true":
        animator = BIDIRECTION
    if search_type == "dijkstra":
        seq, coords, path = animator.dijkstra_animation(source, dest)
    elif search_type == "astar":
        seq, coords, path = animator.astar_animation(
            source, dest, heuristic, epsilon)
    elif search_type == "alt":
        seq, coords, path = animator.alt_animation(source, dest, epsilon)

    data = {
        "sequence": seq,
        "coords": coords,
        "path": path,
        "meta": {
            "elapsed_ms": round((time() - start) * 1000),
            "closed_set_len": len(coords),
            "path_len_nodes": len(path),
            "path_len_km": path_len(path)
        }
    }
    return make_response(json.dumps(data))


@app.route("/")
def index():
    return open("static/gmaps.html", "r").read()


def split_comma_ll(ll_string):
    s = ll_string.split(",")
    return float(s[0]), float(s[1])


if __name__ == "__main__":
    app.run()
