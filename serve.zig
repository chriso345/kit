const std = @import("std");

const port: u16 = 8000;
const io = std.Options.debug_io;

pub fn main() !void {
    const address = std.Io.net.IpAddress.parseIp4(
        "127.0.0.1",
        port,
    ) catch unreachable;

    var listener = try address.listen(io, .{
        .reuse_address = true,
    });
    defer listener.deinit(io);

    std.log.info(
        "Serving kit at http://127.0.0.1:{d}",
        .{port},
    );

    while (true) {
        const stream = listener.accept(io) catch |err| {
            std.log.err("accept failed: {}", .{err});
            continue;
        };

        handleConnection(stream) catch |err| {
            std.log.err("request failed: {}", .{err});
        };
    }
}

fn handleConnection(stream: std.Io.net.Stream) !void {
    defer stream.close(io);

    var read_buffer: [64 * 1024]u8 = undefined;
    var write_buffer: [64 * 1024]u8 = undefined;
    var reader = stream.reader(io, &read_buffer);
    var writer = stream.writer(io, &write_buffer);
    var server = std.http.Server.init(
        &reader.interface,
        &writer.interface,
    );

    var request = try server.receiveHead();
    var path = request.head.target;
    if (std.mem.indexOfScalar(u8, path, '?')) |index|
        path = path[0..index];

    var decoded_path: [4096]u8 = undefined;
    if (path.len > decoded_path.len) {
        return respondText(
            &request,
            "URI Too Long\n",
            .uri_too_long,
        );
    }

    @memcpy(decoded_path[0..path.len], path);
    path = std.Uri.percentDecodeInPlace(
        decoded_path[0..path.len],
    );

    if (!isSafePath(path)) {
        return respondText(
            &request,
            "Forbidden\n",
            .forbidden,
        );
    }

    // Default to index.html for root path.
    if (std.mem.eql(u8, path, "/"))
        path = "/index.html";

    const relative_path =
        if (std.mem.startsWith(u8, path, "/"))
            path[1..]
        else
            path;

    const cwd = std.Io.Dir.cwd();
    const file = cwd.openFile(
        io,
        relative_path,
        .{},
    ) catch |err| switch (err) {
        error.FileNotFound => {
            return respondText(
                &request,
                "Not Found\n",
                .not_found,
            );
        },
        else => return err,
    };
    defer file.close(io);

    const stat = try file.stat(io);
    if (stat.kind != .file) {
        return respondText(
            &request,
            "Not Found\n",
            .not_found,
        );
    }

    const contents = try std.heap.page_allocator.alloc(
        u8,
        stat.size,
    );
    defer std.heap.page_allocator.free(contents);

    var file_reader = file.reader(io, &.{});
    try file_reader.interface.readSliceAll(contents);
    try request.respond(
        contents,
        .{
            .status = .ok,
            .extra_headers = &.{
                .{
                    .name = "Content-Type",
                    .value = contentType(relative_path),
                },
                .{
                    .name = "Cache-Control",
                    .value = "no-cache",
                },
            },
        },
    );
}

fn isSafePath(path: []const u8) bool {
    if (!std.mem.startsWith(u8, path, "/")) {
        return false;
    }

    var components = std.mem.splitScalar(u8, path, '/');
    while (components.next()) |component| {
        if (std.mem.eql(u8, component, "..")) {
            return false;
        }
    }

    return true;
}

fn contentType(path: []const u8) []const u8 {
    if (std.mem.endsWith(u8, path, ".html"))
        return "text/html; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".js"))
        return "text/javascript; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".css"))
        return "text/css; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".json"))
        return "application/json; charset=utf-8";
    if (std.mem.endsWith(u8, path, ".wasm"))
        return "application/wasm";
    if (std.mem.endsWith(u8, path, ".png"))
        return "image/png";
    if (std.mem.endsWith(u8, path, ".jpg") or
        std.mem.endsWith(u8, path, ".jpeg"))
        return "image/jpeg";
    if (std.mem.endsWith(u8, path, ".gif"))
        return "image/gif";
    if (std.mem.endsWith(u8, path, ".svg"))
        return "image/svg+xml";
    if (std.mem.endsWith(u8, path, ".mp4"))
        return "video/mp4";
    if (std.mem.endsWith(u8, path, ".txt"))
        return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

fn respondText(
    request: *std.http.Server.Request,
    text: []const u8,
    status: std.http.Status,
) !void {
    try request.respond(
        text,
        .{
            .status = status,
            .extra_headers = &.{
                .{
                    .name = "Content-Type",
                    .value = "text/plain; charset=utf-8",
                },
            },
        },
    );
}
