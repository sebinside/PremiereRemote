#!/bin/sh
# Runs on the host before the dev container starts. Points .uxp-sync at PREMIERE_REMOTE_SYNC_DIR
# from .env, so only that folder gets mounted at /uxp-sync (see client/scripts/sync-build.js).
cd "$(dirname "$0")/.." || exit 1

PREMIERE_REMOTE_SYNC_DIR=
[ -f .env ] && . ./.env

if [ -L .uxp-sync ]; then rm .uxp-sync; fi
if [ -n "$PREMIERE_REMOTE_SYNC_DIR" ]; then
    rmdir .uxp-sync 2>/dev/null
    mkdir -p "$PREMIERE_REMOTE_SYNC_DIR" && ln -s "$PREMIERE_REMOTE_SYNC_DIR" .uxp-sync
fi
# Mount source must exist, so fall back to an empty folder.
mkdir -p .uxp-sync
