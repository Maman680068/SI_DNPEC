# syntax=docker/dockerfile:1
# Service de calcul « dnpec-calcul » (lot B1). Contexte : le dossier apps/calcul.
#   docker build -t dnpec-calcul apps/calcul
#   docker run -p 8000:8000 -e CALCUL_SECRET=... dnpec-calcul
# Render (plan gratuit, Docker) : « Root Directory » = apps/calcul, Dockerfile = ./Dockerfile.
# Aucun accès à la base ni au stockage de l'application ; seule variable sensible : CALCUL_SECRET.

FROM python:3.11-slim-bookworm AS construction
RUN apt-get update \
 && apt-get install -y --no-install-recommends coinor-libipopt-dev liblapack-dev libblas-dev pkg-config cmake build-essential git \
 && rm -rf /var/lib/apt/lists/*
ENV PYOMO_CONFIG_DIR=/opt/pyomo
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY requirements.txt /tmp/requirements.txt
# Certificat d'autorité facultatif (proxy d'entreprise) : --secret id=ca,src=<fichier.crt>.
# « download-extensions » (demandé) puis « build-extensions » : depuis pyomo 6.10, l'interface
# pynumero utilisée par cyipopt n'est plus téléchargée mais compilée (ASL récupéré par git).
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export PIP_CERT=/run/secrets/ca GIT_SSL_CAINFO=/run/secrets/ca SSL_CERT_FILE=/run/secrets/ca; fi \
 && pip install --no-cache-dir -r /tmp/requirements.txt \
 && (pyomo download-extensions || true) && pyomo build-extensions \
 && test -f /opt/pyomo/lib/libpynumero_ASL.so

FROM python:3.11-slim-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends coinor-libipopt1v5 liblapack3 libblas3 libgfortran5 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 calcul
COPY --from=construction /opt/venv /opt/venv
COPY --from=construction /opt/pyomo /opt/pyomo
ENV PATH=/opt/venv/bin:$PATH PYOMO_CONFIG_DIR=/opt/pyomo PYTHONUNBUFFERED=1 PORT=8000 \
    CALCUL_CACHE_DIR=/tmp/dnpec-paquets
WORKDIR /app
COPY calcul ./calcul
USER calcul
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/sante',timeout=4)"
CMD ["sh", "-c", "exec uvicorn calcul.app:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --no-server-header"]
