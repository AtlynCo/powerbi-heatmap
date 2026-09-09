import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const tag = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
    return Buffer.concat([length, tag, data, crc]);
}
// Both sizes use the same grid design, without external image assets.
function icon(size, filename) {
    const stride = 1 + size * 4;
    const pixels = Buffer.alloc(size * stride, 255);
    const palette = [[189, 215, 231], [107, 174, 214], [8, 81, 156]];
    const cells = [[0, 1, 2], [0, 2, 1], [0, 1, 2]];
    for (let y = 0; y < size; y++) {
        pixels[y * stride] = 0;
        for (let x = 0; x < size; x++) {
            const sy = Math.floor(y * 20 / size);
            const sx = Math.floor(x * 20 / size);
            const r = Math.floor((sy - 2) / 6);
            const c = Math.floor((sx - 2) / 6);
            if (r < 0 || c < 0 || r > 2 || c > 2 || (sy - 2) % 6 >= 4 || (sx - 2) % 6 >= 4) continue;
            for (let channel = 0; channel < 3; channel++) pixels[y * stride + 1 + x * 4 + channel] = palette[cells[r][c]][channel];
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    writeFileSync(new URL(`../assets/${filename}`, import.meta.url), Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))
    ]));
}
icon(20, "icon.png");
icon(300, "icon300.png");
