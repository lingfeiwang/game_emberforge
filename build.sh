#!/usr/bin/env bash
# ============================================================================
# Emberforge Depths — desktop binary build script (Windows / macOS / Linux)
#
# Usage:
#   ./build.sh                 build every target this OS can produce
#   ./build.sh --win           Windows x64 (NSIS installer + zip)
#   ./build.sh --mac           macOS universal (dmg + zip)  [macOS hosts only]
#   ./build.sh --linux         Linux (AppImage + zip)
#   ./build.sh --all           same as no arguments
#   ./build.sh --skip-tests    don't run the headless test suite first
#   ./build.sh --clean         wipe dist/ and node_modules/ before building
#
# Platform support matrix (an electron-builder constraint, not ours):
#   host Linux   → can build: win, linux
#   host macOS   → can build: win, mac, linux
#   host Windows → can build: win            (use Git Bash / WSL to run this)
#
# macOS binaries CANNOT be built on Linux/Windows. If you don't own a Mac,
# run this script in a macOS CI runner (e.g. GitHub Actions `macos-latest`).
#
# Code signing: disabled by default so unsigned dev builds always succeed.
#   - macOS:   export CSC_IDENTITY_AUTO_DISCOVERY=true (+ keychain identity)
#   - Windows: export CSC_LINK / CSC_KEY_PASSWORD (pfx cert)
# Steam note: Steam does not require signed binaries, but signing avoids
# SmartScreen/Gatekeeper friction for direct distribution.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

WANT_WIN=0; WANT_MAC=0; WANT_LINUX=0; EXPLICIT=0
SKIP_TESTS=0; CLEAN=0

for arg in "$@"; do
  case "$arg" in
    --win)        WANT_WIN=1;   EXPLICIT=1 ;;
    --mac)        WANT_MAC=1;   EXPLICIT=1 ;;
    --linux)      WANT_LINUX=1; EXPLICIT=1 ;;
    --all)        ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --clean)      CLEAN=1 ;;
    -h|--help)    awk 'NR>1{ if(/^#/){ sub(/^# ?/,""); print } else exit }' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

HOST="$(uname -s)"
note()  { printf '\033[1;33m[build]\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m[build]\033[0m %s\n' "$*"; exit 1; }

# Default (or --all): everything this host supports
if [ "$EXPLICIT" -eq 0 ]; then
  WANT_WIN=1; WANT_LINUX=1
  [ "$HOST" = "Darwin" ] && WANT_MAC=1
  [ "$HOST" = "Darwin" ] || note "macOS target skipped: requires a macOS host (see --help)."
  case "$HOST" in MINGW*|MSYS*|CYGWIN*) WANT_LINUX=0 ;; esac
fi

# Hard platform gates for explicit requests
if [ "$WANT_MAC" -eq 1 ] && [ "$HOST" != "Darwin" ]; then
  fail "macOS binaries can only be built on a macOS host (electron-builder limitation).
        Use a Mac or a macOS CI runner, then: ./build.sh --mac"
fi
case "$HOST" in
  MINGW*|MSYS*|CYGWIN*)
    [ "$WANT_LINUX" -eq 1 ] && fail "Linux targets cannot be built on a Windows host." ;;
esac

command -v node >/dev/null 2>&1 || fail "node is required (>=18)."
command -v npm  >/dev/null 2>&1 || fail "npm is required."

if [ "$CLEAN" -eq 1 ]; then
  note "cleaning dist/ and node_modules/"
  rm -rf dist node_modules
fi

if [ ! -d node_modules/electron ] || [ ! -d node_modules/electron-builder ]; then
  note "installing dependencies (electron + electron-builder)…"
  npm install
fi

if [ "$SKIP_TESTS" -eq 0 ]; then
  note "running headless test suite (use --skip-tests to skip)…"
  npm test
fi

# Unsigned builds by default — see header to enable signing.
export CSC_IDENTITY_AUTO_DISCOVERY="${CSC_IDENTITY_AUTO_DISCOVERY:-false}"

VERSION="$(node -p "require('./package.json').version")"
note "building Emberforge Depths v$VERSION on $HOST"

BUILT=0
if [ "$WANT_WIN" -eq 1 ]; then
  WIN_TARGET="--win"
  WIN_FLAGS=()
  case "$HOST" in
    MINGW*|MSYS*|CYGWIN*) ;;
    *)
      # Cross-building the Windows exe edits its icon/metadata via wine.
      # Without wine, skip that step (functionally identical exe, default icon).
      if ! command -v wine >/dev/null 2>&1; then
        note "  wine not found — skipping exe icon/metadata editing (install wine to enable)"
        WIN_FLAGS+=( -c.win.signAndEditExecutable=false )
      fi
      # electron-builder's bundled makensis is an x86-64 Linux binary; on other
      # Linux architectures only the zip target can be produced.
      if [ "$HOST" = "Linux" ] && [ "$(uname -m)" != "x86_64" ]; then
        note "  non-x64 Linux host — NSIS installer skipped (zip only); build the installer on x64 Linux/macOS/Windows"
        WIN_TARGET="--win zip"
      fi ;;
  esac
  note "→ Windows x64 ($([ "$WIN_TARGET" = "--win" ] && echo 'nsis + zip' || echo 'zip'))"
  # shellcheck disable=SC2086
  npx electron-builder $WIN_TARGET --x64 --publish never ${WIN_FLAGS[@]+"${WIN_FLAGS[@]}"}
  BUILT=1
fi
if [ "$WANT_MAC" -eq 1 ]; then
  note "→ macOS universal (dmg + zip, Intel + Apple Silicon)"
  # The dmg target needs dmg-license, a macOS-only optional dependency that
  # package managers sometimes skip (yarn, --no-optional, node_modules copied
  # from another OS, older npm). Self-heal before building.
  if ! node -e "require.resolve('dmg-license')" >/dev/null 2>&1; then
    note "  dmg-license missing — installing it (macOS-only optional dependency)…"
    npm install --no-save dmg-license || true
  fi
  if node -e "require.resolve('dmg-license')" >/dev/null 2>&1; then
    npx electron-builder --mac --universal --publish never
  else
    note "  dmg-license could not be installed — building zip only (no dmg)"
    npx electron-builder --mac zip --universal --publish never
  fi
  BUILT=1
fi
if [ "$WANT_LINUX" -eq 1 ]; then
  note "→ Linux (AppImage + zip)"
  npx electron-builder --linux --publish never
  BUILT=1
fi

[ "$BUILT" -eq 1 ] || fail "nothing to build for this host/flag combination."

# ---- artifact manifest (paths + SHA-256, handy for Steam depot bookkeeping) ----
note "artifacts in dist/:"
SUM="sha256sum"; command -v sha256sum >/dev/null 2>&1 || SUM="shasum -a 256"
MANIFEST="dist/SHA256SUMS.txt"
: > "$MANIFEST"
find dist -maxdepth 1 -type f \
    \( -name '*.exe' -o -name '*.zip' -o -name '*.dmg' -o -name '*.AppImage' \) \
    -print0 | sort -z | while IFS= read -r -d '' f; do
  size=$(du -h "$f" | cut -f1)
  hash=$($SUM "$f" | cut -d' ' -f1)
  printf '  %-58s %6s  %s\n' "$(basename "$f")" "$size" "${hash:0:12}…"
  $SUM "$f" >> "$MANIFEST"
done
note "checksums written to $MANIFEST"
note "done."
