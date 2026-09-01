pub const tools = .{
    .{
        .id = "base64",
        .add = @import("tools/base64/build.zig").add,
        .clean = @import("tools/base64/build.zig").clean,
    },
    .{
        .id = "mp4-gif",
        .add = @import("tools/mp4-gif/build.zig").add,
        .clean = @import("tools/mp4-gif/build.zig").clean,
    },
    .{
        .id = "wasm-tool",
        .add = @import("tools/wasm-tool/build.zig").add,
        .clean = @import("tools/wasm-tool/build.zig").clean,
    },
};
