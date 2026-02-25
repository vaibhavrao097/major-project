function normalizeExtractedText(input) {
  if (!input) {
    return "";
  }

  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

module.exports = { normalizeExtractedText };
