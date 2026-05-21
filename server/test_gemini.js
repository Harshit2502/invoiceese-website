const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: 'C:/Users/ASUS/OneDrive/Desktop/invoiceease/server/.env' });

const fetch = require("node-fetch");
require('dotenv').config({ path: 'C:/Users/ASUS/OneDrive/Desktop/invoiceease/server/.env' });

async function test() {
  try {
    const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.replace(/['"]/g, "").trim() : "";
    console.log("Using API key:", key);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }]
      })
    });
    console.log("Status:", response.status);
    console.log("Status text:", response.statusText);
    const body = await response.text();
    console.log("Body:", body);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

test();
