# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# deps del sistema (matplotlib necesita algunas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libfreetype6-dev libpng-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8501
# Streamlit en modo headless
CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.headless=true"]
