// PR Roast Bot - A GitHub App that gives witty, constructive feedback
// Run with: node server.js

const express = require('express');
const { createNodeMiddleware, Probot } = require('probot');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Main bot logic
const bot = (app) => {
  app.on(['pull_request.opened', 'pull_request.synchronize'], async (context) => {
    const pr = context.payload.pull_request;
    
    console.log(`Processing PR #${pr.number}: ${pr.title}`);
    
    try {
      // Get the PR diff
      const diff = await context.octokit.pulls.get({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: pr.number,
        mediaType: {
          format: 'diff'
        }
      });
      
      // Get PR files for more context
      const files = await context.octokit.pulls.listFiles({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: pr.number,
      });
      
      // Generate witty roast using Claude
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
      console.error('Error processing PR:', error);
    }
  });
};

// Generate witty roast using Claude
async function generateRoast(pr, diff, files) {
  const filesChanged = files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n');
  
  const prompt = `You are a witty, sarcastic code reviewer who gives brutally honest but constructive feedback. 
Review this Pull Request and provide a roast that:
- Points out actual issues or improvements (if any)
- Is funny and witty but not mean-spirited
- Gives actionable feedback
- Ends with something encouraging

PR Title: ${pr.title}
PR Description: ${pr.body || 'No description provided'}

Files Changed:
${filesChanged}

Diff (first 3000 chars):
${diff.toString().substring(0, 3000)}

Write your review as a GitHub comment. Use markdown formatting. Start with a hook line, then provide feedback, and end positively.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return message.content[0].text;
}

// Setup Probot
const probot = new Probot({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY,
  secret: process.env.WEBHOOK_SECRET,
});

probot.load(bot);

// Express middleware
app.use(createNodeMiddleware(bot, { probot }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 PR Roast Bot is running on port ${PORT}`);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('PR Roast Bot is alive! 🔥');
});