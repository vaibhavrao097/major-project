const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).apiKey; // Dummy init to check key
    console.log("Checking available models...");
    
    // This is the specific command to list all models
    // We strictly look for models that support 'generateContent'
    // There isn't a direct listModels() in the node SDK for all versions, 
    // so we will try the most common ones one-by-one to see which reacts.
    
    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
        "gemini-pro",
        "gemini-1.5-flash-latest"
    ];

    for (const modelName of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Test");
            console.log(`✅ AVAILABLE: ${modelName}`);
            // If we find one that works, we stop!
            process.exit(0); 
        } catch (e) {
            console.log(`❌ Failed: ${modelName} (${e.message.split('[')[0]})`);
        }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

listModels();