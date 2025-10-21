# packing.py
from functools import lru_cache
from typing import List, Tuple

Placement = Tuple[int, int, int, int]  # (x, y, w, h) en unidades enteras

def _shift(placements: List[Placement], dx: int = 0, dy: int = 0) -> List[Placement]:
    return [(x + dx, y + dy, w, h) for (x, y, w, h) in placements]

@lru_cache(maxsize=None)
def _pack_cached(W: int, H: int, w: int, h: int) -> Tuple[int, Tuple[Placement, ...]]:
    """
    Empaquetado guillotina para rectángulo W×H con paneles w×h idénticos.
    Devuelve (count, placements) con placements como tupla de (x, y, w, h).
    Internamente considera ambas orientaciones (w×h y h×w) y toma la mejor.
    """
    best_count = 0
    best_pl = ()

    # probar ambas orientaciones en este nodo
    for pw, ph in ((w, h), (h, w)):
        if pw <= 0 or ph <= 0 or W <= 0 or H <= 0:
            continue

        m = W // pw  # cuantos entran horizontal
        n = H // ph  # cuantos entran vertical
        if m == 0 or n == 0:
            continue

        used_w = m * pw
        used_h = n * ph

        # base: grilla llena pw×ph
        base: List[Placement] = []
        for i in range(int(m)):
            for j in range(int(n)):
                base.append((i * pw, j * ph, pw, ph))

        # opción A: partir lado derecho (right strip)
        right_W = W - used_w
        if right_W > 0:
            c_r, p_r = _pack_cached(right_W, H, w, h)
            opt_right = (len(base) + c_r, tuple(base) + tuple((x + used_w, y, ww, hh) for (x, y, ww, hh) in p_r))
        else:
            opt_right = (len(base), tuple(base))

        # opción B: partir arriba (top strip)
        top_H = H - used_h
        if top_H > 0:
            c_t, p_t = _pack_cached(W, top_H, w, h)
            opt_top = (len(base) + c_t, tuple(base) + tuple((x, y + used_h, ww, hh) for (x, y, ww, hh) in p_t))
        else:
            opt_top = (len(base), tuple(base))

        cand = opt_right if opt_right[0] >= opt_top[0] else opt_top
        if cand[0] > best_count:
            best_count, best_pl = cand

    return best_count, best_pl

def pack_count_and_layout(x: float, y: float, a: float, b: float, precision: float = 0.1):
    """
    Interfaz pública con floats. Escala a enteros según 'precision' (ej: 0.1 -> 1 dec).
    - x,y: techo
    - a,b: panel (alto=a, ancho=b)
    Devuelve (count, placements, scale_info)
    """
    if min(x, y, a, b, precision) <= 0:
        return 0, [], {"scale": precision, "W": 0, "H": 0, "w": 0, "h": 0}

    scale = precision
    W = int(round(x / scale))
    H = int(round(y / scale))
    w = int(round(b / scale))  # ancho panel
    h = int(round(a / scale))  # alto panel

    # limpiar cache entre runs si cambias muchos tamaños
    _pack_cached.cache_clear()

    count, placements = _pack_cached(W, H, w, h)
    return count, list(placements), {"scale": scale, "W": W, "H": H, "w": w, "h": h}
