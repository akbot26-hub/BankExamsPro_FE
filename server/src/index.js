import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`BankExamsPro API listening on http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY
    ? 'AI narration: Claude'
    : 'AI narration: built-in engine (set ANTHROPIC_API_KEY for Claude-written insights)');
});
