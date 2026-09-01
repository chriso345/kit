#!/usr/bin/env bash

set -e

clang \
  --target=wasm32 \
  -O3 \
  -nostdlib \
  -Wl,--no-entry \
  -Wl,--export-all \
  main.c \
  -o tool.wasm
