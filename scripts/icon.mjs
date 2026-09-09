import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// Lossless, deterministic 20px icon; the adjacent SVG is the editable design.
const pixels = Buffer.alloc(20 * (1 + 20 * 4), 255);
const palette = [[189, 215, 231], [107, 174, 214], [8, 81, 156]];
const cells = [[0, 1, 2], [0, 2, 1], [0, 1, 2]];
for (let y = 0; y < 20; y++) {
    pixels[y * 81] = 0;
    for (let x = 0; x < 20; x++) {
        const r = Math.floor((y - 2) / 6);
        const c = Math.floor((x - 2) / 6);
        if (r < 0 || c < 0 || r > 2 || c > 2 || (y - 2) % 6 >= 4 || (x - 2) % 6 >= 4) continue;
        for (let channel = 0; channel < 3; channel++) pixels[y * 81 + 1 + x * 4 + channel] = palette[cells[r][c]][channel];
    }
}
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
const header = Buffer.alloc(13);
header.writeUInt32BE(20, 0);
header.writeUInt32BE(20, 4);
header[8] = 8;
header[9] = 6;
writeFileSync(new URL("../assets/icon.png", import.meta.url), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))
]));
