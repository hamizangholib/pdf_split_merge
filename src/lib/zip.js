/**
 * Minimal store-only (uncompressed) ZIP writer.
 *
 * ponytail: no compression — PDFs are already compressed, so deflate would buy
 * a percent or two in exchange for a dependency. Swap in fflate if archives of
 * compressible files ever land here.
 */

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed date/time, as the ZIP local header expects. */
function dosStamp(date = new Date()) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Packs `entries` ([{ name, bytes }]) into a ZIP archive.
 * Names are stored as UTF-8 with the language-encoding flag set.
 */
export function zipStore(entries) {
  const encoder = new TextEncoder();
  const stamp = dosStamp();

  const records = entries.map((entry) => ({
    name: encoder.encode(entry.name),
    bytes: entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes),
  }));
  records.forEach((record) => {
    record.crc = crc32(record.bytes);
  });

  const localSize = records.reduce(
    (total, record) => total + 30 + record.name.length + record.bytes.length,
    0,
  );
  const centralSize = records.reduce((total, record) => total + 46 + record.name.length, 0);

  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let offset = 0;

  const u16 = (value) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const u32 = (value) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const raw = (bytes) => {
    output.set(bytes, offset);
    offset += bytes.length;
  };

  for (const record of records) {
    record.offset = offset;
    u32(0x04034b50); // local file header
    u16(20); // version needed
    u16(0x0800); // UTF-8 names
    u16(0); // method: store
    u16(stamp.time);
    u16(stamp.date);
    u32(record.crc);
    u32(record.bytes.length); // compressed size
    u32(record.bytes.length); // uncompressed size
    u16(record.name.length);
    u16(0); // extra field length
    raw(record.name);
    raw(record.bytes);
  }

  const centralOffset = offset;

  for (const record of records) {
    u32(0x02014b50); // central directory header
    u16(20); // version made by
    u16(20); // version needed
    u16(0x0800);
    u16(0);
    u16(stamp.time);
    u16(stamp.date);
    u32(record.crc);
    u32(record.bytes.length);
    u32(record.bytes.length);
    u16(record.name.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk number start
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(record.offset);
    raw(record.name);
  }

  u32(0x06054b50); // end of central directory
  u16(0); // this disk
  u16(0); // disk with central directory
  u16(records.length);
  u16(records.length);
  u32(offset - centralOffset);
  u32(centralOffset);
  u16(0); // comment length

  return output;
}
