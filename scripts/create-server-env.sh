#!/usr/bin/env bash
# Run inside ~/monitoring-mobil on the server, after the MAXTRACKER_* lines are in .env.
# Appends AUTH_SECRET, POSTGRES_PASSWORD and generated accounts to .env and writes ACCOUNTS.txt (both mode 600).
# Safe to re-run: each value is only added when missing. Accounts are imported into the database once, while it is empty.
set -euo pipefail
umask 077
touch .env
mkdir -p data pgdata
if ! grep -q '^POSTGRES_PASSWORD=' .env; then
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
  echo "Added POSTGRES_PASSWORD."
fi
if grep -q '^AUTH_SECRET=' .env; then echo "AUTH_SECRET already set; accounts left unchanged."; chmod 600 .env; exit 0; fi
pw() { openssl rand -hex 6; }
A=$(pw); D1=$(pw); D2=$(pw); D3=$(pw)
{
  echo "AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
  echo "ADMIN_ACCOUNTS_JSON='[{\"id\":\"admin-1\",\"name\":\"Admin\",\"username\":\"admin\",\"password\":\"$A\"}]'"
  echo "DRIVER_ACCOUNTS_JSON='[{\"id\":\"driver-1\",\"name\":\"Sopir 1\",\"username\":\"sopir1\",\"password\":\"$D1\"},{\"id\":\"driver-2\",\"name\":\"Sopir 2\",\"username\":\"sopir2\",\"password\":\"$D2\"},{\"id\":\"driver-3\",\"name\":\"Sopir 3\",\"username\":\"sopir3\",\"password\":\"$D3\"}]'"
  echo "PASSENGER_ACCOUNTS_JSON='[]'"
} >> .env
cat > ACCOUNTS.txt <<TXT
Peran  Username  Password
admin  admin     $A
sopir  sopir1    $D1
sopir  sopir2    $D2
sopir  sopir3    $D3
TXT
chmod 600 .env ACCOUNTS.txt
echo "Done. Variables in .env:"; cut -d= -f1 .env
