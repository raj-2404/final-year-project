/**
 * CodeX LSP Transport
 * Level 3A — JSON-RPC 2.0 Framing & Transport over stdio
 *
 * Implements standard LSP framing:
 * Content-Length: <byte_length>\r\n\r\n{ ...json... }
 */

/**
 * Serializes a JSON-RPC message into LSP stdio framing.
 * @param {object} message - JSON-RPC object
 * @returns {string} Framed string
 */
export function serializeLspMessage(message) {
  const jsonStr = JSON.stringify(message);
  // Calculate byte length using TextEncoder for accurate UTF-8 length
  const byteLength = new TextEncoder().encode(jsonStr).length;
  return `Content-Length: ${byteLength}\r\n\r\n${jsonStr}`;
}

/**
 * Streaming parser for incoming LSP stdio stdout chunks.
 * Accurately extracts Content-Length and parses complete JSON-RPC messages.
 */
export class LspStreamParser {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.buffer = '';
  }

  /**
   * Appends incoming chunk and parses any complete messages.
   * @param {string} chunk - Raw stdout text
   */
  append(chunk) {
    if (!chunk) return;
    this.buffer += chunk;
    this.processBuffer();
  }

  processBuffer() {
    while (this.buffer.length > 0) {
      // Look for header/body separator \r\n\r\n
      const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) {
        break; // Incomplete headers
      }

      const headerText = this.buffer.slice(0, headerEndIndex);
      const contentLengthMatch = /Content-Length:\s*(\d+)/i.exec(headerText);

      if (!contentLengthMatch) {
        // Malformed header, skip forward
        console.warn('[LspStreamParser] Missing Content-Length header, skipping invalid chunk');
        this.buffer = this.buffer.slice(headerEndIndex + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStartIndex = headerEndIndex + 4;
      const bodyBytesAvailable = new TextEncoder().encode(this.buffer.slice(bodyStartIndex)).length;

      if (bodyBytesAvailable < contentLength) {
        break; // Incomplete body, wait for next chunk
      }

      // Slice the message content safely handling multi-byte UTF-8
      const fullBodySlice = this.sliceUtf8(this.buffer.slice(bodyStartIndex), contentLength);
      this.buffer = this.buffer.slice(bodyStartIndex + fullBodySlice.charCount);

      try {
        const parsed = JSON.parse(fullBodySlice.text);
        if (this.onMessage) {
          this.onMessage(parsed);
        }
      } catch (err) {
        console.warn('[LspStreamParser] Error parsing JSON-RPC body:', err, fullBodySlice.text);
      }
    }
  }

  /**
   * Slices exact byte length from UTF-8 string.
   * @private
   */
  sliceUtf8(str, byteLength) {
    const encoder = new TextEncoder();
    let currentBytes = 0;
    let charCount = 0;

    for (const char of str) {
      const charBytes = encoder.encode(char).length;
      if (currentBytes + charBytes > byteLength) break;
      currentBytes += charBytes;
      charCount += char.length;
    }

    return {
      text: str.slice(0, charCount),
      charCount,
    };
  }

  /**
   * Resets the buffer.
   */
  reset() {
    this.buffer = '';
  }
}
