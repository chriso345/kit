export const SHAPE_TYPES = {
	0: "Null Shape",
	1: "Point",
	3: "PolyLine",
	5: "Polygon",
	8: "MultiPoint",
	11: "PointZ",
	13: "PolyLineZ",
	15: "PolygonZ",
	18: "MultiPointZ",
	21: "PointM",
	23: "PolyLineM",
	25: "PolygonM",
	28: "MultiPointM",
	31: "MultiPatch",
};

const POINT_TYPES = new Set([1, 11, 21]);
const MULTIPOINT_TYPES = new Set([8, 18, 28]);
const PATH_TYPES = new Set([3, 5, 13, 15, 23, 25]);
const POLYGON_TYPES = new Set([5, 15, 25]);

export function parseShapefile(buffer) {
	const view = new DataView(buffer);

	if (view.byteLength < 100) {
		throw new Error("File is too small to be a valid .shp file.");
	}

	const fileCode = view.getInt32(0, false);
	if (fileCode !== 9994) {
		throw new Error("Not a valid shapefile (missing 9994 file code).");
	}

	const fileLength = view.getInt32(24, false) * 2; // stored as 16-bit words
	const version = view.getInt32(28, true);
	const shapeType = view.getInt32(32, true);
	const bbox = {
		xmin: view.getFloat64(36, true),
		ymin: view.getFloat64(44, true),
		xmax: view.getFloat64(52, true),
		ymax: view.getFloat64(60, true),
	};

	const shapes = [];
	let offset = 100;

	while (offset + 8 <= view.byteLength) {
		const recordNumber = view.getInt32(offset, false);
		const contentLengthBytes = view.getInt32(offset + 4, false) * 2;
		const contentStart = offset + 8;
		const contentEnd = contentStart + contentLengthBytes;

		// Guard against truncated/corrupt files rather than throwing mid-parse.
		if (contentLengthBytes < 4 || contentEnd > view.byteLength) break;

		const recordShapeType = view.getInt32(contentStart, true);
		shapes.push(
			parseShapeRecord(view, contentStart, recordNumber, recordShapeType),
		);

		offset = contentEnd;
	}

	return {
		fileCode,
		fileLength,
		version,
		shapeType,
		shapeTypeName: SHAPE_TYPES[shapeType] ?? `Unknown (${shapeType})`,
		bbox,
		shapes,
	};
}

function readPoints(view, offset, count) {
	const points = new Array(count);
	for (let i = 0; i < count; i++) {
		points[i] = {
			x: view.getFloat64(offset, true),
			y: view.getFloat64(offset + 8, true),
		};
		offset += 16;
	}
	return points;
}

function parseShapeRecord(view, start, recordNumber, shapeType) {
	const typeName = SHAPE_TYPES[shapeType] ?? `Unknown (${shapeType})`;

	if (shapeType === 0) {
		return { recordNumber, shapeType, typeName, parts: [] };
	}

	// Point / PointZ / PointM: X (f64) then Y (f64), right after the 4-byte type.
	if (POINT_TYPES.has(shapeType)) {
		const x = view.getFloat64(start + 4, true);
		const y = view.getFloat64(start + 12, true);
		return { recordNumber, shapeType, typeName, parts: [[{ x, y }]] };
	}

	// MultiPoint family: type(4) + box(32) + numPoints(4) + points(16*n).
	if (MULTIPOINT_TYPES.has(shapeType)) {
		const numPoints = view.getInt32(start + 36, true);
		const points = readPoints(view, start + 40, numPoints);
		return { recordNumber, shapeType, typeName, parts: [points] };
	}

	// PolyLine/Polygon family: type(4) + box(32) + numParts(4) + numPoints(4)
	// + parts index array(4*numParts) + points(16*numPoints).
	if (PATH_TYPES.has(shapeType)) {
		const numParts = view.getInt32(start + 36, true);
		const numPoints = view.getInt32(start + 40, true);

		const partIndex = new Array(numParts);
		let p = start + 44;
		for (let i = 0; i < numParts; i++) {
			partIndex[i] = view.getInt32(p, true);
			p += 4;
		}

		const allPoints = readPoints(view, p, numPoints);
		const parts = partIndex.map((startIdx, i) => {
			const endIdx = i + 1 < partIndex.length ? partIndex[i + 1] : numPoints;
			return allPoints.slice(startIdx, endIdx);
		});

		return {
			recordNumber,
			shapeType,
			typeName,
			parts,
			closed: POLYGON_TYPES.has(shapeType),
		};
	}

	return { recordNumber, shapeType, typeName, parts: [], unsupported: true };
}

export function parseDbf(buffer) {
	const view = new DataView(buffer);
	const bytes = new Uint8Array(buffer);

	if (bytes.length < 32) {
		throw new Error("File is too small to be a valid .dbf file.");
	}

	const recordCount = view.getInt32(4, true);
	const headerLength = view.getInt16(8, true);
	const recordLength = view.getInt16(10, true);

	const fields = [];
	let offset = 32;
	// Field descriptor array ends with a 0x0D terminator byte.
	while (offset < headerLength - 1 && bytes[offset] !== 0x0d) {
		const name = decodeAscii(bytes, offset, 11).replace(/\0.*$/, "").trim();
		const type = String.fromCharCode(bytes[offset + 11]);
		const length = bytes[offset + 16];
		const decimalCount = bytes[offset + 17];
		fields.push({ name, type, length, decimalCount });
		offset += 32;
	}

	const records = [];
	let recordOffset = headerLength;
	for (let i = 0; i < recordCount; i++) {
		if (recordOffset + recordLength > bytes.length) break; // truncated file

		const deleted = bytes[recordOffset] === 0x2a;
		let fieldOffset = recordOffset + 1; // skip the deletion flag byte
		const record = {};
		for (const field of fields) {
			const raw = decodeAscii(bytes, fieldOffset, field.length);
			record[field.name] = castDbfValue(raw, field);
			fieldOffset += field.length;
		}
		if (!deleted) records.push(record);
		recordOffset += recordLength;
	}

	return { fields, records };
}

function decodeAscii(bytes, offset, length) {
	let s = "";
	for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i]);
	return s;
}

function castDbfValue(raw, field) {
	const trimmed = raw.trim();
	switch (field.type) {
		case "N": // Numeric
		case "F": // Float
			return trimmed === "" ? null : Number(trimmed);
		case "L": // Logical
			return (
				{ T: true, Y: true, F: false, N: false }[trimmed.toUpperCase()] ?? null
			);
		case "D": // Date, stored as YYYYMMDD
			return trimmed.length === 8
				? `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
				: trimmed;
		default: // Character, Memo, etc.
			return trimmed;
	}
}

export function parsePrjName(text) {
	const match = text.match(/^\s*(?:PROJCS|GEOGCS)\s*\[\s*"([^"]+)"/i);
	if (match) return match[1].replace(/_/g, " ");
	return text.trim().slice(0, 80) || "Unknown projection";
}

export function computeBounds(shapefile) {
	const hdr = shapefile.bbox;
	if (
		hdr &&
		Number.isFinite(hdr.xmin) &&
		Number.isFinite(hdr.ymax) &&
		hdr.xmax > hdr.xmin &&
		hdr.ymax > hdr.ymin
	) {
		return hdr;
	}

	let xmin = Infinity;
	let ymin = Infinity;
	let xmax = -Infinity;
	let ymax = -Infinity;

	for (const shape of shapefile.shapes) {
		for (const part of shape.parts) {
			for (const pt of part) {
				if (pt.x < xmin) xmin = pt.x;
				if (pt.x > xmax) xmax = pt.x;
				if (pt.y < ymin) ymin = pt.y;
				if (pt.y > ymax) ymax = pt.y;
			}
		}
	}

	if (!Number.isFinite(xmin)) return { xmin: 0, ymin: 0, xmax: 1, ymax: 1 };
	return { xmin, ymin, xmax, ymax };
}
