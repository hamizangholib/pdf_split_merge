/**
 * Self-check for the image sniffing in `compress.js`:
 * `node src/lib/compress.selfcheck.mjs`
 *
 * Only `describeImage` is checked here. The rest of the module needs a canvas,
 * which node has not got — but this is the part that fails silently: mistake a
 * palette image for RGB and the compressor writes a document full of confetti,
 * with no error anywhere. Every case below is a stream shape a real PDF
 * contains.
 */
import assert from 'node:assert/strict';
import { PDFContext, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { describeImage } from './compress.js';

const context = PDFContext.create();
const empty = new Uint8Array(0);

/** Builds an image XObject dictionary from plain entries. */
function image(entries) {
  const stream = PDFRawStream.of(context.obj({ Type: 'XObject', Subtype: 'Image', ...entries }), empty);
  return stream.dict;
}

const rgb = { Width: 100, Height: 50, BitsPerComponent: 8, ColorSpace: 'DeviceRGB' };

// A plain JPEG: the browser decodes these directly.
assert.deepEqual(describeImage(image({ ...rgb, Filter: 'DCTDecode' })), { kind: 'jpeg' });

// A JPEG behind another filter is not a JPEG any decoder here can hand back.
assert.equal(
  describeImage(
    image({ ...rgb, Filter: context.obj([PDFName.of('ASCII85Decode'), PDFName.of('DCTDecode')]) }),
  ),
  null,
);

// Deflated 8-bit samples — what a pasted screenshot becomes.
assert.deepEqual(describeImage(image({ ...rgb, Filter: 'FlateDecode' })), {
  kind: 'raw',
  width: 100,
  height: 50,
  components: 3,
});

assert.deepEqual(
  describeImage(image({ ...rgb, ColorSpace: 'DeviceGray', Filter: 'FlateDecode' })),
  { kind: 'raw', width: 100, height: 50, components: 1 },
);

// An ICC profile is read for its component count, not trusted blindly.
const profile = context.register(
  PDFRawStream.of(context.obj({ N: PDFNumber.of(3) }), empty),
);
assert.deepEqual(
  describeImage(
    image({
      ...rgb,
      Filter: 'FlateDecode',
      ColorSpace: context.obj([PDFName.of('ICCBased'), profile]),
    }),
  ),
  { kind: 'raw', width: 100, height: 50, components: 3 },
);

const cmyk = context.register(PDFRawStream.of(context.obj({ N: PDFNumber.of(4) }), empty));
assert.equal(
  describeImage(
    image({
      ...rgb,
      Filter: 'FlateDecode',
      ColorSpace: context.obj([PDFName.of('ICCBased'), cmyk]),
    }),
  ),
  null,
  'four-channel CMYK must be skipped, not read as RGB',
);

// Everything below would decode into garbage if it were treated as raw RGB.
const skipped = {
  'indexed palette': { ColorSpace: context.obj([PDFName.of('Indexed')]), Filter: 'FlateDecode' },
  'PNG predictor': {
    Filter: 'FlateDecode',
    DecodeParms: context.obj({ Predictor: PDFNumber.of(15) }),
  },
  '1-bit fax scan': { Filter: 'CCITTFaxDecode', BitsPerComponent: 1 },
  'JPEG 2000': { Filter: 'JPXDecode' },
  'stencil mask': { Filter: 'FlateDecode', ImageMask: true },
  'inverted decode array': {
    Filter: 'FlateDecode',
    Decode: context.obj([PDFNumber.of(1), PDFNumber.of(0)]),
  },
  'no filter at all': { Filter: undefined },
};

for (const [label, entries] of Object.entries(skipped)) {
  assert.equal(describeImage(image({ ...rgb, ...entries })), null, `${label} must be skipped`);
}

// Not an image at all.
assert.equal(
  describeImage(PDFRawStream.of(context.obj({ Type: 'XObject', Subtype: 'Form' }), empty).dict),
  null,
);

console.log('compress self-check ok');
