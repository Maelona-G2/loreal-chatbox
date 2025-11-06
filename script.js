/* Clean, beginner-friendly chat client that calls OpenAI's Chat Completions
   - Keeps the API key out of this file (secrets.js should define OPENAI_API_KEY)
   - Uses async/await and a messages array
   - Extracts data.choices[0].message.content from the response
*/

// DOM elements
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const responseDiv = document.getElementById("response");

// Ensure required DOM exists
if (!chatForm || !userInput || !chatWindow) {
  console.error(
    "Missing required DOM elements: chatForm, userInput, or chatWindow."
  );
  throw new Error("Required DOM elements not found.");
}

// System prompt limiting assistant to L'Oréal-related topics
const SYSTEM_PROMPT = `You are a helpful assistant that ONLY answers questions about L'Oréal products, routines, and related beauty topics (skincare, haircare, makeup, product recommendations, ingredients, usage, and routines). Always be concise, accurate, and polite. Ask clarifying questions when needed. If a user asks anything unrelated to L'Oréal or general beauty topics, politely refuse with: "Sorry — I can only help with L'Oréal products, routines, and related beauty questions." Do not provide medical, legal, or diagnostic advice; instead direct users to consult a qualified professional.`;

// Conversation state: keeps context across turns (system message first)
const messages = [{ role: "system", content: SYSTEM_PROMPT }];

// Track simple user metadata (e.g., name) for personalization
let userName = null;

// Helper: append message to chat window and scroll (creates bubble layout)
function appendMessage(text, className, meta = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${className}`; // "msg user" or "msg ai"

  // Optional name label for user messages
  if (meta.name) {
    const nameEl = document.createElement("div");
    nameEl.className = "msg-name";
    nameEl.textContent = meta.name;
    wrapper.appendChild(nameEl);
  }

  const textEl = document.createElement("div");
  textEl.className = "msg-text";
  textEl.textContent = text;
  wrapper.appendChild(textEl);

  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return wrapper;
}

// Show the user's latest question above the assistant's response
function showLatestQuestion(text) {
  // remove any existing latest-question block
  const existing = chatWindow.querySelector(".latest-question");
  if (existing) existing.remove();

  const q = document.createElement("div");
  q.className = "latest-question";
  q.textContent = `Latest question: ${text}`;
  chatWindow.appendChild(q);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return q;
}

// Safe check to see whether secrets.js provided the key (DO NOT log the key)
const OPENAI_KEY_PRESENT =
  typeof OPENAI_API_KEY !== "undefined" && !!OPENAI_API_KEY;
console.log("OPENAI_API_KEY present:", OPENAI_KEY_PRESENT);

// Initial friendly AI message (visible on load) and add to context
const initialText =
  "👋 Hello! How can I help you with L'Oréal products or routines today?";
appendMessage(initialText, "ai");
messages.push({ role: "assistant", content: initialText });

// Form submit: gather user text, call OpenAI, and display reply
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Try to capture user's name if they introduce it (simple heuristic)
  const nameMatch = text.match(/\b(?:my name is|i'm|i am)\s+([A-Z][a-z]+)\b/i);
  if (nameMatch) {
    userName = nameMatch[1];
    // Add a system note so the model can use the name in future replies
    messages.push({ role: "system", content: `User's name is ${userName}.` });
  }

  // Show user message bubble (include name if known)
  appendMessage(text, "user", { name: userName || "You" });

  // Add user message to conversation context
  messages.push({ role: "user", content: text });

  // Clear input and disable while waiting for reply
  userInput.value = "";
  userInput.disabled = true;

  // Show latest question above response area and a thinking indicator
  showLatestQuestion(text);
  const thinking = document.createElement("div");
  thinking.className = "msg ai thinking";
  thinking.textContent = "…thinking";
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    if (!OPENAI_KEY_PRESENT) {
      throw new Error(
        "OpenAI API key not found. Create secrets.js and define OPENAI_API_KEY."
      );
    }

    // Send the full messages context to OpenAI (keeps conversation context)
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 600,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();

    // Per requirement: extract assistant reply from data.choices[0].message.content
    const aiContent = data?.choices?.[0]?.message?.content;
    if (!aiContent) {
      throw new Error("No content in API response.");
    }

    // Remove thinking indicator, append assistant message, and add it to context
    thinking.remove();
    appendMessage(aiContent, "ai");
    messages.push({ role: "assistant", content: aiContent });
  } catch (err) {
    if (thinking.parentNode) thinking.remove();
    appendMessage(`Error: ${err.message}`, "ai");
    console.error(err);
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
});
