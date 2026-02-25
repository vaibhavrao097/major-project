function cosineSimilarity(vecA, vecB) {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (!denominator) {
    return 0;
  }

  return dot / denominator;
}

module.exports = { cosineSimilarity };
