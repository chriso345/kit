const std = @import("std");

pub fn add(
    b: *std.Build,
    parent: *std.Build.Step,
) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const module = b.createModule(.{
        .target = target,
        .optimize = .ReleaseSmall,
    });

    module.addCSourceFile(.{
        .file = b.path("tools/wasm-tool/main.c"),
        .flags = &.{
            "-O3",
            "-nostdlib",
        },
    });

    const exe = b.addExecutable(.{
        .name = "wasm-tool",
        .root_module = module,
    });

    exe.entry = .disabled;
    exe.root_module.export_symbol_names = &.{
        "add",
    };

    const copy = b.addSystemCommand(&.{
        "cp",
    });

    copy.addFileArg(exe.getEmittedBin());
    copy.addArg("tools/wasm-tool/tool.wasm");

    copy.step.dependOn(&exe.step);
    parent.dependOn(&copy.step);
}
