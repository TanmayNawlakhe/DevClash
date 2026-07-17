# GitSuri backend (API + worker share this image).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/data/hf_cache

WORKDIR /app

# git: the analyzer clones repos with `git clone`.
# build-essential: safety net for any packages that build from source.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-only torch first (far smaller than the default CUDA build), then the rest.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
