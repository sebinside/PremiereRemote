/**
 * @fileoverview Copies the build folder to a Windows-visible directory, because the Windows UXP
 * tooling does not pick up changes made inside WSL or a dev container.
 *
 * Set PREMIERE_REMOTE_SYNC_DIR in the repo root .env (see .env.example) or the environment,
 * e.g. /mnt/d/code/PremiereRemote-Build. Unset: syncing is skipped.
 * Native WSL: copies directly to that folder.
 * Dev container: .devcontainer/link-sync-dir.sh points the .uxp-sync symlink at that folder on
 * the host before the container starts, and the container mounts it at /uxp-sync.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.join(clientDir, "..");
const envFile = path.join(rootDir, ".env");
if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
}

const target = process.env.PREMIERE_REMOTE_SYNC_DIR;
const containerMount = "/uxp-sync";
const inContainer = fs.existsSync("/.dockerenv");

function warn(message) {
    console.warn(`\x1b[33m[sync-build] ${message}\x1b[0m`);
}

function readLink(file) {
    try {
        return fs.readlinkSync(file);
    } catch {
        return undefined;
    }
}

function copyTo(destination) {
    for (const entry of ["manifest.json", "build", "icons"]) {
        fs.cpSync(path.join(clientDir, entry), path.join(destination, entry), {
            recursive: true,
        });
    }
    console.log(`[sync-build] Copied build to ${target}`);
}

if (target && inContainer) {
    const mountedDir = readLink(path.join(rootDir, ".uxp-sync"));
    if (!fs.existsSync(containerMount)) {
        warn(
            `${containerMount} is not mounted. Rebuild the container to enable syncing.`,
        );
    } else if (mountedDir !== target) {
        warn(
            `${containerMount} is not mounted to ${target}. Restart the container to apply .env.`,
        );
    } else {
        copyTo(containerMount);
    }
} else if (target) {
    if (fs.existsSync(target)) {
        copyTo(target);
    } else {
        warn(
            `Sync target ${target} does not exist. Create it or fix PREMIERE_REMOTE_SYNC_DIR.`,
        );
    }
}
