# Ruuf — Solar Panel Packing (Python + Streamlit)

Implementación para calcular el **máximo número de paneles rectangulares `a×b`** que caben dentro de un **techo rectangular `x×y`**, **permitiendo rotación 0°/90°**, y **dibujar** el layout resultante.

- **Lenguaje**: Python 3.11
- **Frontend**: Streamlit
- **Algoritmo**: cortes **guillotina** con **memoización** (DP + `@lru_cache`) para piezas idénticas. El enfoque evita depender del área disponible y respeta la **rigidez** de los paneles.

> Easter‑egg opcional: escribir `ruuf` en el campo **Unidad** activa un modo de depuración que numera los paneles y habilita la descarga de un PNG del layout.

---

## Ejecución

### Opción A — Docker
```bash
docker compose up --build
# Abrir: http://localhost:8501
```
- Cuando no se monta el código como volumen, cualquier cambio en `.py` requiere reconstruir:  
  `docker compose up --build --force-recreate`

### Opción B — Local (sin Docker)
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

---

## Diseño de la solución

### Interfaz pública (`packing.py`)
```py
pack_count_and_layout(x, y, a, b, precision=0.1) -> (count, placements, meta)
```
1. Escalado a enteros mediante `precision` para decisiones exactas.
2. Llamado a `_pack_cached(W, H, w, h)` que:
   - prueba ambas orientaciones del panel (0°/90°);
   - coloca una **grilla máxima** de paneles completos;
   - explora dos particiones guillotina (franja **derecha** o **superior**);
   - selecciona la alternativa con mayor cantidad de paneles;
   - memoiza subproblemas repetidos con `@lru_cache`.

### Frontend (`app.py`)
- Lectura de parámetros (`x, y, a, b, precision`) en la barra lateral.
- Llamado a `pack_count_and_layout`.
- Dibujo del techo y paneles con `matplotlib`.
- Modo debug opcional (`ruuf` en **Unidad**): numeración en celdas y botón para descargar PNG.


## Estructura

```
.
├── app.py
├── packing.py
├── requirements.txt
└── README.md
```

---

## (Opcional) Tests rápidos con pytest

`tests/test_packing.py`:
```py
from packing import pack_count_and_layout

def test_counter_example():
    c, _, _ = pack_count_and_layout(20, 3, 2, 2, precision=1)
    assert c == 10

def test_rotated():
    c, _, _ = pack_count_and_layout(5, 3, 2, 1, precision=1)
    assert c == 7

def test_edge():
    c, _, _ = pack_count_and_layout(3, 3, 2, 2, precision=1)
    assert c == 1
```
Ejecución:
```bash
pip install pytest
pytest -q
```

---

## Notas

- El algoritmo modela piezas rígidas y no realiza cortes parciales.
- El parámetro `precision` controla el escalado a enteros cuando se ingresan decimales.
- La disposición dibujada corresponde a una solución óptima dentro del esquema guillotina considerado.
