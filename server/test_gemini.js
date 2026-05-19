const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: 'C:/Users/ASUS/OneDrive/Desktop/invoiceease/server/.env' });

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = "Hello, respond in JSON: {\"status\": \"ok\"}";
    
    console.log("Calling gemini...");
    const result = await model.generateContent([prompt]);
    console.log("Result:", result.response.text());
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
