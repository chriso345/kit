const std = @import("std");

pub fn add(
    b: *std.Build,
    parent: *std.Build.Step,
) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const exe = b.addExecutable(.{
        .name = "base64",
        .root_module = b.createModule(.{
            .root_source_file = b.path("tools/base64/base64.zig"),
            .target = target,
            .optimize = .ReleaseSmall,
        }),
    });

    exe.entry = .disabled;

    exe.root_module.export_symbol_names = &.{
        "input_ptr",
        "output_ptr",
        "input_capacity",
        "output_capacity",
        "had_decode_error",
        "encode",
        "decode",
    };

    const copy = b.addSystemCommand(&.{
        "cp",
    });

    copy.addFileArg(exe.getEmittedBin());
    copy.addArg("tools/base64/base64.wasm");

    copy.step.dependOn(&exe.step);
    parent.dependOn(&copy.step);
}

pub fn clean(b: *std.Build, parent: *std.Build.Step) void {
    const rm_wasm = b.addSystemCommand(&.{ "rm", "-f", "tools/base64/base64.wasm" });
    rm_wasm.setName("clean base64");
    parent.dependOn(&rm_wasm.step);

    const rm_cache = b.addSystemCommand(&.{ "rm", "-rf", "tools/base64/.zig-cache" });
    rm_cache.setName("clean base64 cache");
    parent.dependOn(&rm_cache.step);
}
