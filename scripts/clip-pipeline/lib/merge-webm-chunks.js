'use strict';

const CLUSTER_ID = Buffer.from([0x1f, 0x43, 0xb6, 0x75]);
const EBML_ID = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

function isEbmlHeader(buf) {
  return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

function findClusterOffset(buf) {
  for (let i = 4; i < buf.length - 4; i += 1) {
    if (
      buf[i] === CLUSTER_ID[0]
      && buf[i + 1] === CLUSTER_ID[1]
      && buf[i + 2] === CLUSTER_ID[2]
      && buf[i + 3] === CLUSTER_ID[3]
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * MediaRecorder emits continuation chunks that may repeat EBML headers on keyframes.
 * Keep the first chunk intact; strip duplicate headers from later chunks so only
 * cluster data is concatenated after the init segment.
 */
function normalizeChunkBuffer(buf, index) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }
  if (index === 0 || !isEbmlHeader(buf)) {
    return buf;
  }
  const clusterAt = findClusterOffset(buf);
  if (clusterAt > 0) {
    return buf.slice(clusterAt);
  }
  return buf;
}

function mergeWebmChunkBuffers(buffers) {
  const parts = (buffers || []).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return normalizeChunkBuffer(parts[0], 0);

  const normalized = parts.map((part, index) => normalizeChunkBuffer(part, index));
  return Buffer.concat(normalized);
}

module.exports = {
  mergeWebmChunkBuffers,
  isEbmlHeader,
  findClusterOffset,
  normalizeChunkBuffer,
};
