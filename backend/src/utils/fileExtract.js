const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * Extract plain text from a PDF or DOCX buffer/path.
 * @param {Buffer|string} source  Buffer or absolute file path
 * @param {string} mimetype       e.g. 'application/pdf', 'application/vnd.openxmlformats...'
 * @returns {Promise<string>}
 */
const extractText = async (source, mimetype) => {
  const buf = Buffer.isBuffer(source) ? source : fs.readFileSync(source);

  if (mimetype === 'application/pdf' || mimetype === 'application/x-pdf') {
    const result = await pdfParse(buf);
    return result.text.trim();
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    mimetype === 'application/docx'
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value.trim();
  }

  // Plain text fallback
  if (mimetype?.startsWith('text/')) {
    return buf.toString('utf-8').trim();
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
};

module.exports = { extractText };
