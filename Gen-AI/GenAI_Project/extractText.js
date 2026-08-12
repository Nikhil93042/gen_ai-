const fs = require('fs');
const pdf = require('pdf-parse');

/**
 * Extract raw text content from a PDF file.
 * Handles Node.js Buffer to Uint8Array normalization for complete cross-version compatibility.
 * 
 * @param {string} filePath - Absolute or relative path to target PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found at: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  // Ensure typed array compatibility across all Node versions
  const uint8Data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const data = await pdf(uint8Data);
  return data.text;
}

module.exports = extractText;