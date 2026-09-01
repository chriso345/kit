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

pub fn clean(b: *std.Build, parent: *std.Build.Step) void {
    const rm_wasm = b.addSystemCommand(&.{ "rm", "-f", "tools/wasm-tool/tool.wasm" });
    rm_wasm.setName("clean wasm-tool");
    parent.dependOn(&rm_wasm.step);

    const rm_cache = b.addSystemCommand(&.{ "rm", "-rf", "tools/wasm-tool/.zig-cache" });
    rm_cache.setName("clean wasm-tool cache");
    parent.dependOn(&rm_cache.step);
}
