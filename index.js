// PR Roast Bot - A GitHub App that gives witty, constructive feedback
// Run with: node server.js

const express = require("express");
const { createNodeMiddleware, Probot } = require("probot");
require("dotenv").config();

const app = express();

// Add body parser for webhooks
app.use(express.json());

// Choose your AI provider (set in Railway env vars)
const AI_PROVIDER = process.env.AI_PROVIDER || "groq";

// Main bot logic
const bot = (app) => {
  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      const pr = context.payload.pull_request;

      console.log(`Processing PR #${pr.number}: ${pr.title}`);

      try {
        // Get the PR diff
        const diff = await context.octokit.pulls.get({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          pull_number: pr.number,
          mediaType: {
            format: "diff",
          },
        });

        // Get PR files for more context
        const files = await context.octokit.pulls.listFiles({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          pull_number: pr.number,
        });

        // Generate witty roast using chosen AI
        const roast = await generateRoast(pr, diff.data, files.data);

        // Post comment on PR
        await context.octokit.issues.createComment({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          issue_number: pr.number,
          body: roast,
        });

        console.log(`Posted roast on PR #${pr.number}`);
      } catch (error) {
        console.error("Error processing PR:", error);
      }
    }
  );
};

// Generate witty roast using free AI
async function generateRoast(pr, diff, files) {
  const filesChanged = files
    .map((f) => `- ${f.filename} (+${f.additions}/-${f.deletions})`)
    .join("\n");

  const prompt = `You are a witty, sarcastic code reviewer who gives brutally honest but constructive feedback. 
Review this Pull Request and provide a roast that:
- Points out actual issues or improvements (if any)
- Is funny and witty but not mean-spirited
- Gives actionable feedback
- Ends with something encouraging

PR Title: ${pr.title}
PR Description: ${pr.body || "No description provided"}

Files Changed:
${filesChanged}

Diff (first 3000 chars):
${diff.toString().substring(0, 3000)}

Write your review as a GitHub comment. Use markdown formatting. Start with a hook line, then provide feedback, and end positively.`;

  try {
    // Choose AI provider based on env variable
    switch (AI_PROVIDER) {
      case "groq":
        return await generateRoastWithGroq(prompt);
      case "gemini":
        return await generateRoastWithGemini(prompt);
      case "huggingface":
        return await generateRoastWithHuggingFace(prompt);
      default:
        return await generateRoastWithGroq(prompt);
    }
  } catch (error) {
    console.error("AI generation error:", error);
    return `🤖 Beep boop! My AI brain is temporarily offline. But hey, at least your code compiled! That's worth celebrating, right? 🎉\n\nError: ${error.message}`;
  }
}

// GROQ API (Recommended - Fast & Free)
async function generateRoastWithGroq(prompt) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a witty, sarcastic code reviewer who gives brutally honest but constructive feedback.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    }
  );

  const data = await response.json();
  return data.choices[0].message.content;
}

// Google Gemini API (Generous Free Tier)
async function generateRoastWithGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1000,
        },
      }),
    }
  );

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Hugging Face API (100% Free)
async function generateRoastWithHuggingFace(prompt) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: `<s>[INST] ${prompt} [/INST]`,
        parameters: {
          max_new_tokens: 1000,
          temperature: 0.8,
        },
      }),
    }
  );

  const data = await response.json();
  return data[0].generated_text.split("[/INST]")[1].trim();
}

// Health check endpoint
app.get("/", (req, res) => {
  res.send(`PR Roast Bot is alive! 🔥<br>AI Provider: ${AI_PROVIDER}`);
});

// Setup Probot with proper middleware
const probot = new Probot({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY,
  secret: process.env.WEBHOOK_SECRET,
});

// Load bot and setup middleware
probot.load(bot).then(() => {
  // Add webhook endpoint
  app.post("/api/github/webhooks", async (req, res) => {
    await probot.webhooks.receive({
      id: req.headers["x-github-delivery"],
      name: req.headers["x-github-event"],
      payload: req.body,
    });
    res.sendStatus(200);
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🤖 PR Roast Bot is running on port ${PORT}`);
  });
});
