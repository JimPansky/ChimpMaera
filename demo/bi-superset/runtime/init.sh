#!/usr/bin/env bash
set -euo pipefail
umask 077
superset db upgrade
superset init
python /opt/chimpmaera-bi/bootstrap.py
