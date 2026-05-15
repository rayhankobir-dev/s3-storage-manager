import "server-only";

/**
 * Minimal streaming ZIP writer — STORE method only (no compression).
 *
 * STORE is fine for object-storage downloads because the user's files
 * (images, videos, archives) are usually already compressed. Skipping
 * deflate keeps CPU/memory cost flat regardless of folder size.
 *
 * Uses the "data descriptor" trick (bit 3) so we can write each local
 * file header without knowing the size upfront, then patch the
 * size+crc into the descriptor after we've finished streaming the body.
 *
 * Limitations:
 *  - No ZIP64. Individual files must be <4 GiB and the archive total
 *    must be <4 GiB. Most browsers also cap downloads anyway.
 *  - File modification time is set to a constant 1980-01-01.
 */

export type ZipEntrySource = {
    path: string;
    body: AsyncIterable<Uint8Array>;
};

type ZipEntryMeta = {
    pathBytes: Uint8Array;
    crc32: number;
    size: number;
    offset: number;
};

const SIG_LOCAL = 0x04034b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 20;
// 0x0800 = UTF-8 filename; 0x0008 = data descriptor follows file data.
const GP_FLAG = 0x0808;
const METHOD_STORE = 0;
// Earliest valid DOS date: 1980-01-01 00:00:00.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32Update(crc: number, chunk: Uint8Array): number {
    let c = crc ^ 0xffffffff;
    for (let i = 0; i < chunk.length; i++) {
        c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function utf8Bytes(s: string): Uint8Array {
    return new TextEncoder().encode(s);
}

function buildLocalHeader(pathBytes: Uint8Array): Uint8Array {
    const buf = new Uint8Array(30 + pathBytes.length);
    const dv = new DataView(buf.buffer);
    let p = 0;
    dv.setUint32(p, SIG_LOCAL, true); p += 4;
    dv.setUint16(p, VERSION_NEEDED, true); p += 2;
    dv.setUint16(p, GP_FLAG, true); p += 2;
    dv.setUint16(p, METHOD_STORE, true); p += 2;
    dv.setUint16(p, DOS_TIME, true); p += 2;
    dv.setUint16(p, DOS_DATE, true); p += 2;
    // CRC-32, compressed size, uncompressed size — zero, written into data descriptor.
    dv.setUint32(p, 0, true); p += 4;
    dv.setUint32(p, 0, true); p += 4;
    dv.setUint32(p, 0, true); p += 4;
    dv.setUint16(p, pathBytes.length, true); p += 2;
    dv.setUint16(p, 0, true); p += 2;
    buf.set(pathBytes, p);
    return buf;
}

function buildDataDescriptor(crc: number, size: number): Uint8Array {
    const buf = new Uint8Array(16);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, SIG_DATA_DESCRIPTOR, true);
    dv.setUint32(4, crc, true);
    dv.setUint32(8, size, true);
    dv.setUint32(12, size, true);
    return buf;
}

function buildCentralRecord(entry: ZipEntryMeta): Uint8Array {
    const buf = new Uint8Array(46 + entry.pathBytes.length);
    const dv = new DataView(buf.buffer);
    let p = 0;
    dv.setUint32(p, SIG_CENTRAL, true); p += 4;
    dv.setUint16(p, VERSION_MADE_BY, true); p += 2;
    dv.setUint16(p, VERSION_NEEDED, true); p += 2;
    dv.setUint16(p, GP_FLAG, true); p += 2;
    dv.setUint16(p, METHOD_STORE, true); p += 2;
    dv.setUint16(p, DOS_TIME, true); p += 2;
    dv.setUint16(p, DOS_DATE, true); p += 2;
    dv.setUint32(p, entry.crc32, true); p += 4;
    dv.setUint32(p, entry.size, true); p += 4;
    dv.setUint32(p, entry.size, true); p += 4;
    dv.setUint16(p, entry.pathBytes.length, true); p += 2;
    dv.setUint16(p, 0, true); p += 2; // extra length
    dv.setUint16(p, 0, true); p += 2; // comment length
    dv.setUint16(p, 0, true); p += 2; // disk number
    dv.setUint16(p, 0, true); p += 2; // internal attrs
    dv.setUint32(p, 0, true); p += 4; // external attrs
    dv.setUint32(p, entry.offset, true); p += 4;
    buf.set(entry.pathBytes, p);
    return buf;
}

function buildEndOfCentral(count: number, centralSize: number, centralOffset: number): Uint8Array {
    const buf = new Uint8Array(22);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, SIG_END, true);
    dv.setUint16(4, 0, true);  // disk number
    dv.setUint16(6, 0, true);  // disk with cd
    dv.setUint16(8, count, true);
    dv.setUint16(10, count, true);
    dv.setUint32(12, centralSize, true);
    dv.setUint32(16, centralOffset, true);
    dv.setUint16(20, 0, true); // comment length
    return buf;
}

/** Stream a STORE-only zip built from the given async source of entries. */
export function createZipStream(source: AsyncIterable<ZipEntrySource>): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            const entries: ZipEntryMeta[] = [];
            let offset = 0;
            try {
                for await (const entry of source) {
                    const pathBytes = utf8Bytes(entry.path);
                    const local = buildLocalHeader(pathBytes);
                    controller.enqueue(local);
                    const localStart = offset;
                    offset += local.length;

                    let crc = 0;
                    let size = 0;
                    for await (const chunk of entry.body) {
                        crc = crc32Update(crc, chunk);
                        size += chunk.length;
                        controller.enqueue(chunk);
                        offset += chunk.length;
                    }
                    const descriptor = buildDataDescriptor(crc, size);
                    controller.enqueue(descriptor);
                    offset += descriptor.length;

                    entries.push({ pathBytes, crc32: crc, size, offset: localStart });
                }

                const centralStart = offset;
                for (const entry of entries) {
                    const record = buildCentralRecord(entry);
                    controller.enqueue(record);
                    offset += record.length;
                }
                const centralSize = offset - centralStart;
                controller.enqueue(buildEndOfCentral(entries.length, centralSize, centralStart));
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        },
    });
}
