const INPUT_CAPACITY: usize = 8 * 1024 * 1024; // 8 MB
const OUTPUT_CAPACITY: usize = 12 * 1024 * 1024; // ~4/3 headroom for encoding

var input_buf: [INPUT_CAPACITY]u8 = undefined;
var output_buf: [OUTPUT_CAPACITY]u8 = undefined;
var decode_error: bool = false;

const encode_table: [64]u8 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".*;

export fn input_ptr() [*]u8 {
    return &input_buf;
}

export fn output_ptr() [*]u8 {
    return &output_buf;
}

export fn input_capacity() usize {
    return INPUT_CAPACITY;
}

export fn output_capacity() usize {
    return OUTPUT_CAPACITY;
}

export fn had_decode_error() bool {
    return decode_error;
}

/// Encodes `input_len` bytes from input_buf into output_buf.
/// Returns the number of bytes written.
export fn encode(input_len: usize) usize {
    if (input_len > INPUT_CAPACITY) return 0;

    var out_i: usize = 0;
    var i: usize = 0;
    while (i + 3 <= input_len) : (i += 3) {
        const b0 = input_buf[i];
        const b1 = input_buf[i + 1];
        const b2 = input_buf[i + 2];
        output_buf[out_i] = encode_table[b0 >> 2];
        output_buf[out_i + 1] = encode_table[((b0 & 0x03) << 4) | (b1 >> 4)];
        output_buf[out_i + 2] = encode_table[((b1 & 0x0f) << 2) | (b2 >> 6)];
        output_buf[out_i + 3] = encode_table[b2 & 0x3f];
        out_i += 4;
    }

    const remaining = input_len - i;
    if (remaining == 1) {
        const b0 = input_buf[i];
        output_buf[out_i] = encode_table[b0 >> 2];
        output_buf[out_i + 1] = encode_table[(b0 & 0x03) << 4];
        output_buf[out_i + 2] = '=';
        output_buf[out_i + 3] = '=';
        out_i += 4;
    } else if (remaining == 2) {
        const b0 = input_buf[i];
        const b1 = input_buf[i + 1];
        output_buf[out_i] = encode_table[b0 >> 2];
        output_buf[out_i + 1] = encode_table[((b0 & 0x03) << 4) | (b1 >> 4)];
        output_buf[out_i + 2] = encode_table[(b1 & 0x0f) << 2];
        output_buf[out_i + 3] = '=';
        out_i += 4;
    }

    return out_i;
}

fn decodeChar(c: u8) i8 {
    if (c >= 'A' and c <= 'Z') return @intCast(c - 'A');
    if (c >= 'a' and c <= 'z') return @intCast(c - 'a' + 26);
    if (c >= '0' and c <= '9') return @intCast(c - '0' + 52);
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;
}

/// Decodes `input_len` bytes (base64 text) from input_buf into output_buf.
/// Returns the number of bytes written; check had_decode_error() for validity.
export fn decode(input_len: usize) usize {
    decode_error = false;
    if (input_len > INPUT_CAPACITY) {
        decode_error = true;
        return 0;
    }

    var out_i: usize = 0;
    var buffer: u32 = 0;
    var bits: u5 = 0;
    var i: usize = 0;
    while (i < input_len) : (i += 1) {
        const c = input_buf[i];
        if (c == '=' or c == '\n' or c == '\r' or c == ' ') continue;
        const val = decodeChar(c);
        if (val < 0) {
            decode_error = true;
            return out_i;
        }
        buffer = (buffer << 6) | @as(u32, @intCast(val));
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output_buf[out_i] = @intCast((buffer >> bits) & 0xFF);
            out_i += 1;
        }
    }

    return out_i;
}
