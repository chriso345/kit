#!/usr/bin/env bash
# Should go through each folder in the tools/ directory, take the manifest.json files, and build a registry.js file in the tools/ directory.
#
# This should contain keys:
#  id: the name of the tool (the folder name)
#  name: the name of the tool (from the manifest.json)
#  description: the description of the tool (from the manifest.json)
#  version: the version of the tool (from the manifest.json)
#
# It should also run the build.command (from the manifest.json) for each tool, if it exists.
#
# If build.artifact is specified, only run the build command if the artifact
# doesn't exist or if any non-json/js/wasm file is newer than the artifact.

set -e

TOOLS_DIR="tools"
REGISTRY="$TOOLS_DIR/registry.js"

echo "Building tools..."

registry="export const TOOLS = ["

first=true

for tool_dir in "$TOOLS_DIR"/*/; do
  [ -d "$tool_dir" ] || continue

  manifest="$tool_dir/manifest.json"

  [ -f "$manifest" ] || continue

  id=$(basename "$tool_dir")

  # Validate the manifest and extract its fields.
  manifest_id=$(jq -r '.id' "$manifest")
  name=$(jq -r '.name' "$manifest")
  description=$(jq -r '.description' "$manifest")
  version=$(jq -r '.version' "$manifest")
  command=$(jq -r '.build.command // empty' "$manifest")
  artifact=$(jq -r '.build.artifact // empty' "$manifest")

  if [ "$manifest_id" != "$id" ]; then
    echo "Error: manifest id '$manifest_id' does not match folder '$id'"
    exit 1
  fi

  # Run the build command if one exists.
  if [ -n "$command" ]; then
    should_build=true

    if [ -n "$artifact" ] && [ -f "$tool_dir/$artifact" ]; then
      should_build=false

      # Find source files that aren't json/js/wasm and check whether
      # any of them are newer than the artifact.
      while read -r file; do
        if [ "$file" -nt "$tool_dir/$artifact" ]; then
          should_build=true
          break
        fi
      done < <(
        find "$tool_dir" -type f \
          ! -name '*.json' \
          ! -name '*.js' \
          ! -name '*.wasm'
      )
    fi

    if [ "$should_build" = true ]; then
      echo "Building $id..."
      (
        cd "$tool_dir"
        bash -c "$command"
      )
    else
      echo "$id is up to date."
    fi
  fi

  if [ "$first" = false ]; then
    registry="$registry,"
  fi

  first=false

  # Use jq to safely escape strings for JavaScript.
  entry=$(
    jq -n \
      --arg id "$id" \
      --arg name "$name" \
      --arg description "$description" \
      --arg version "$version" \
      '{id: $id, name: $name, description: $description, version: $version}'
  )

  registry="$registry
  $entry"
done

registry="$registry
];"

printf '%s\n' "$registry" >"$REGISTRY"

echo "Wrote $REGISTRY"
