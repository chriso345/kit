pub const tools = .{
    .{
        .id = "base64",
        .add = @import("tools/base64/build.zig").add,
    },
    .{
        .id = "mp4-gif",
        .add = @import("tools/mp4-gif/build.zig").add,
    },
    .{
        .id = "wasm-tool",
        .add = @import("tools/wasm-tool/build.zig").add,
    },
};
