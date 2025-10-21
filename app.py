# app.py
import streamlit as st
import matplotlib.pyplot as plt
from io import BytesIO
from packing import pack_count_and_layout

# mini easter egg: algún día soportaremos paneles hexagonales. TODO: bees. 🐝

st.set_page_config(page_title="Ruuf — Solar Panel Packing", page_icon="🔧", layout="centered")

st.title("Ruuf — Solar Panel Packing (Python + Streamlit)")
st.caption("Empaquetado guillotina con rotación 0°/90° para rectángulos idénticos.")

# ---- Sidebar inputs
with st.sidebar:
    st.header("Dimensiones")
    unit = st.text_input("Unidad", value="m")
    precision = float(st.selectbox("Precisión interna", ["1", "0.1", "0.01"], index=1))

    x = st.number_input("Ancho techo (x)", min_value=0.0, value=5.0, step=0.1)
    y = st.number_input("Alto techo (y)", min_value=0.0, value=3.0, step=0.1)
    a = st.number_input("Alto panel (a)", min_value=0.0, value=2.0, step=0.1)
    b = st.number_input("Ancho panel (b)", min_value=0.0, value=1.0, step=0.1)

# ---- Modo debug secreto: escribir "ruuf" en Unidad
easter = (unit or "").strip().lower()
debug_mode = ("ruuf" in easter)

count, placements, meta = pack_count_and_layout(x, y, a, b, precision=precision)

st.subheader(f"Resultado: {count} panel(es)")
if debug_mode:
    st.caption("🕵️ Debug Ninjas: numeración y descarga activadas.")
st.caption(f"Escala interna: {meta['scale']} {unit} por unidad — W={meta['W']}, H={meta['H']}, w={meta['w']}, h={meta['h']}")

# ---- Drawing
fig, ax = plt.subplots(figsize=(6, 4))
# Techo
ax.add_patch(plt.Rectangle((0, 0), meta["W"], meta["H"], fill=False, linewidth=2, linestyle="--"))
# Paneles
for (px, py, pw, ph) in placements:
    ax.add_patch(plt.Rectangle((px, py), pw, ph, fill=False, linewidth=1))

# Numeración si debug
if debug_mode:
    for idx, (px, py, pw, ph) in enumerate(placements, start=1):
        ax.text(px + pw/2, py + ph/2, str(idx), ha="center", va="center", fontsize=7)

ax.set_xlim(0, meta["W"])
ax.set_ylim(0, meta["H"])
ax.set_aspect("equal", adjustable="box")
ax.invert_yaxis()
ax.set_xticks([])
ax.set_yticks([])
st.pyplot(fig)

# Botón de descarga PNG (siempre útil, aparece igual)
buf = BytesIO()
fig.savefig(buf, format="png", dpi=160, bbox_inches="tight")
st.download_button("Descargar layout (.png)", data=buf.getvalue(),
                   file_name="ruuf_packing_layout.png", mime="image/png")

# ---- Detalles
with st.expander("Detalles"):
    st.write({"inputs": {"x": x, "y": y, "a": a, "b": b}, "scaled": meta})
    st.write("Primeras ubicaciones:", placements[:10])
