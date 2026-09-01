#!/usr/bin/env bash

set -e

FFMPEG_VERSION="0.12.10"
CORE_VERSION="0.12.6"

VENDOR_DIR="vendor"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Fetching @ffmpeg/ffmpeg@${FFMPEG_VERSION} and @ffmpeg/core@${CORE_VERSION} from npm..."
npm pack "@ffmpeg/ffmpeg@${FFMPEG_VERSION}" --pack-destination "$WORK_DIR" >/dev/null
npm pack "@ffmpeg/core@${CORE_VERSION}" --pack-destination "$WORK_DIR" >/dev/null

mkdir -p "$WORK_DIR/ffmpeg-pkg" "$WORK_DIR/core-pkg"
tar -xzf "$WORK_DIR"/ffmpeg-ffmpeg-*.tgz -C "$WORK_DIR/ffmpeg-pkg" --strip-components=1
tar -xzf "$WORK_DIR"/ffmpeg-core-*.tgz -C "$WORK_DIR/core-pkg" --strip-components=1

rm -rf "$VENDOR_DIR"
mkdir -p "$VENDOR_DIR/ffmpeg" "$VENDOR_DIR/core"

cp -r "$WORK_DIR/ffmpeg-pkg/dist/esm/." "$VENDOR_DIR/ffmpeg/"
cp -r "$WORK_DIR/core-pkg/dist/esm/." "$VENDOR_DIR/core/"

echo "Vendored ffmpeg.wasm into $VENDOR_DIR/ (ffmpeg ${FFMPEG_VERSION}, core ${CORE_VERSION})"
