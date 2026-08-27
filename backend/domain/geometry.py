"""Polygon and geometry validation (motor puro — no Django imports)."""

from __future__ import annotations


def polygon_self_intersects(points: list[dict[str, float]]) -> bool:
    """Check if polygon has self-intersecting edges.

    Uses O(n²) pairwise line segment intersection.
    Returns True if any two non-adjacent edges intersect.
    """
    if len(points) < 3:
        return False

    def ccw(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> bool:
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])

    def segments_intersect(
        p1: tuple[float, float],
        p2: tuple[float, float],
        p3: tuple[float, float],
        p4: tuple[float, float],
    ) -> bool:
        return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)

    for i in range(len(points)):
        for j in range(i + 2, len(points)):
            if j == len(points) - 1 and i == 0:
                continue
            p1 = (points[i]["x"], points[i]["y"])
            p2 = (points[(i + 1) % len(points)]["x"], points[(i + 1) % len(points)]["y"])
            p3 = (points[j]["x"], points[j]["y"])
            p4 = (points[(j + 1) % len(points)]["x"], points[(j + 1) % len(points)]["y"])
            if segments_intersect(p1, p2, p3, p4):
                return True

    return False


def polygon_area(points: list[dict[str, float]]) -> float:
    """Calculate polygon area using the shoelace formula."""
    if len(points) < 3:
        return 0.0

    area = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]["x"], points[i]["y"]
        x2, y2 = points[(i + 1) % len(points)]["x"], points[(i + 1) % len(points)]["y"]
        area += x1 * y2 - x2 * y1

    return abs(area) / 2.0


def point_in_rectangle(
    point: dict[str, float], rect: dict[str, float]
) -> bool:
    """Check if point is within rectangle bounds."""
    x, y = point["x"], point["y"]
    rect_x = rect.get("x", 0)
    rect_y = rect.get("y", 0)
    rect_width = rect.get("width", 0)
    rect_height = rect.get("height", 0)

    return (
        rect_x <= x <= rect_x + rect_width
        and rect_y <= y <= rect_y + rect_height
    )


def polygon_in_rectangle(
    points: list[dict[str, float]], rect: dict[str, float]
) -> bool:
    """Check if all polygon points are within rectangle bounds."""
    return all(point_in_rectangle(p, rect) for p in points)


def validate_geometry(
    geometry: dict, site_width: float, site_height: float
) -> dict[str, list[str]]:
    """Validate geometry object (rect or polygon).

    Returns dict of field errors: {"geometry": ["error1", "error2"], ...}
    Empty dict if valid.
    """
    errors = {}

    if not isinstance(geometry, dict):
        return {"geometry": ["Must be an object"]}

    geom_type = geometry.get("type", "rect")

    if geom_type == "polygon":
        points = geometry.get("points", [])

        if not isinstance(points, list):
            errors["points"] = ["Must be an array"]
        elif len(points) < 3:
            errors["points"] = ["Polygon must have at least 3 points"]
        else:
            for _i, p in enumerate(points):
                if not isinstance(p, dict) or not all(k in p for k in ("x", "y")):
                    errors["points"] = ["Each point must have x and y"]
                    break

            if not errors:
                site_rect = {"x": 0, "y": 0, "width": site_width, "height": site_height}
                if not polygon_in_rectangle(points, site_rect):
                    errors["points"] = [
                        "All polygon points must be within site boundaries"
                    ]
                elif polygon_self_intersects(points):
                    errors["points"] = ["Polygon has self-intersecting edges"]
                elif polygon_area(points) <= 0.0001:
                    errors["points"] = ["Polygon area must be greater than zero"]

    elif geom_type == "rect":
        required = ("x", "y", "width", "height")
        rect = {k: geometry.get(k) for k in required}

        if not all(k in geometry for k in required):
            errors["geometry"] = [
                f"Rectangle must have {', '.join(required)}"
            ]
        else:
            x, y, w, h = rect["x"], rect["y"], rect["width"], rect["height"]
            if not all(isinstance(v, int | float) for v in [x, y, w, h]):
                errors["geometry"] = ["Rectangle values must be numbers"]
            elif not isinstance(w, int | float) or not isinstance(h, int | float):
                errors["geometry"] = ["Rectangle width and height must be numeric"]
            elif w <= 0 or h <= 0:
                errors["geometry"] = ["Rectangle width and height must be positive"]
            elif (
                not isinstance(x, int | float)
                or not isinstance(y, int | float)
                or x < 0
                or y < 0
                or x + w > site_width
                or y + h > site_height
            ):
                errors["geometry"] = ["Rectangle must be within site boundaries"]
    else:
        errors["geometry"] = ["Type must be 'rect' or 'polygon'"]

    return errors


def rect_to_polygon(rect: dict) -> dict:
    """Convert rectangle geometry to polygon representation.

    Input: {x, y, width, height}
    Output: {type: "polygon", points: [{x, y}, ...]}
    """
    x, y = rect.get("x", 0), rect.get("y", 0)
    w, h = rect.get("width", 0), rect.get("height", 0)

    return {
        "type": "polygon",
        "points": [
            {"x": x, "y": y},
            {"x": x + w, "y": y},
            {"x": x + w, "y": y + h},
            {"x": x, "y": y + h},
        ],
    }
