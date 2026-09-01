const std = @import("std");

const FFMPEG_VERSION = "0.12.10";
const CORE_VERSION = "0.12.6";

pub fn add(
    b: *std.Build,
    parent: *std.Build.Step,
) void {
    const command = b.addSystemCommand(&.{
        "bash",
        "-c",
        \\set -e
        \\FFMPEG_VERSION="0.12.10"
        \\CORE_VERSION="0.12.6"
        \\VENDOR_DIR="tools/mp4-gif/vendor"
        \\WORK_DIR="$(mktemp -d)"
        \\trap 'rm -rf "$WORK_DIR"' EXIT
        \\
        \\echo "Fetching @ffmpeg/ffmpeg@${FFMPEG_VERSION}..."
        \\npm pack "@ffmpeg/ffmpeg@${FFMPEG_VERSION}" --pack-destination "$WORK_DIR" >/dev/null
        \\
        \\echo "Fetching @ffmpeg/core@${CORE_VERSION}..."
        \\npm pack "@ffmpeg/core@${CORE_VERSION}" --pack-destination "$WORK_DIR" >/dev/null
        \\
        \\mkdir -p "$WORK_DIR/ffmpeg-pkg" "$WORK_DIR/core-pkg"
        \\
        \\tar -xzf "$WORK_DIR"/ffmpeg-ffmpeg-*.tgz -C "$WORK_DIR/ffmpeg-pkg" --strip-components=1
        \\tar -xzf "$WORK_DIR"/ffmpeg-core-*.tgz -C "$WORK_DIR/core-pkg" --strip-components=1
        \\
        \\rm -rf "$VENDOR_DIR"
        \\mkdir -p "$VENDOR_DIR/ffmpeg" "$VENDOR_DIR/core"
        \\
        \\cp -r "$WORK_DIR/ffmpeg-pkg/dist/esm/." "$VENDOR_DIR/ffmpeg/"
        \\cp -r "$WORK_DIR/core-pkg/dist/esm/." "$VENDOR_DIR/core/"
        \\
        \\echo "Vendored ffmpeg into $VENDOR_DIR (ffmpeg ${FFMPEG_VERSION}, core ${CORE_VERSION})"
    });

    command.setName("vendor mp4-gif");
    parent.dependOn(&command.step);
}

pub fn clean(b: *std.Build, parent: *std.Build.Step) void {
    const rm_vendor = b.addSystemCommand(&.{ "rm", "-rf", "tools/mp4-gif/vendor" });
    rm_vendor.setName("clean mp4-gif vendor");
    parent.dependOn(&rm_vendor.step);

    const rm_cache = b.addSystemCommand(&.{ "rm", "-rf", "tools/mp4-gif/.zig-cache" });
    rm_cache.setName("clean mp4-gif cache");
    parent.dependOn(&rm_cache.step);
}
