#!/usr/bin/env bash

set -e

zig build-exe base64.zig \
  -target wasm32-freestanding \
  -O ReleaseSmall \
  -fno-entry \
  --export=input_ptr \
  --export=output_ptr \
  --export=input_capacity \
  --export=output_capacity \
  --export=had_decode_error \
  --export=encode \
  --export=decode \
  -femit-bin=base64.wasm
