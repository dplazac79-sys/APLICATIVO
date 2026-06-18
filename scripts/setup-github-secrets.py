#!/usr/bin/env python3
"""
Configura los GitHub Actions Secrets del repositorio APIP.
Lee los valores desde .env.local (nunca los hardcodea).

Uso: python3 scripts/setup-github-secrets.py <GITHUB_PAT>

El PAT debe tener el scope: repo (para poder escribir secrets).
"""

import sys, os, base64, json, urllib.request, urllib.error

try:
    from nacl import encoding, public
except ImportError:
    print("Instalando PyNaCl...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "PyNaCl"], check=True)
    from nacl import encoding, public

REPO = "dplazac79-sys/APLICATIVO"

# Nombres de los secrets a sincronizar desde .env.local → GitHub Actions
SECRET_KEYS = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "VOYAGE_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "ESCALACION_SECRET",
    "APP_URL",
]

def load_env(path: str) -> dict:
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

def encrypt_secret(pub_key_b64: str, secret_value: str) -> str:
    pub_key_bytes = base64.b64decode(pub_key_b64)
    sealed = public.SealedBox(public.PublicKey(pub_key_bytes))
    encrypted = sealed.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

def api(path: str, token: str, method="GET", body=None):
    url = f"https://api.github.com{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read()) if r.length != 0 else {}

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/setup-github-secrets.py <GITHUB_PAT>")
        sys.exit(1)

    token = sys.argv[1]

    # Buscar .env.local relativo a este script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "..", ".env.local")
    if not os.path.exists(env_path):
        print(f"Error: no se encontró .env.local en {env_path}")
        sys.exit(1)

    env = load_env(env_path)

    secrets = {k: env[k] for k in SECRET_KEYS if k in env}
    missing = [k for k in SECRET_KEYS if k not in env]
    if missing:
        print(f"Advertencia: las siguientes variables no están en .env.local y se omitirán:")
        for k in missing:
            print(f"  - {k}")
        print()

    print(f"Obteniendo clave pública del repo {REPO}...")
    pk = api(f"/repos/{REPO}/actions/secrets/public-key", token)
    key_id = pk["key_id"]
    key_b64 = pk["key"]
    print(f"  key_id: {key_id}\n")

    for name, value in secrets.items():
        encrypted = encrypt_secret(key_b64, value)
        api(
            f"/repos/{REPO}/actions/secrets/{name}",
            token,
            method="PUT",
            body={"encrypted_value": encrypted, "key_id": key_id},
        )
        print(f"  ✓ {name}")

    print(f"\nListo — {len(secrets)} secrets configurados en GitHub Actions.")

if __name__ == "__main__":
    main()
