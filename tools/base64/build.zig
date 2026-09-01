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
