import { useState } from 'react';
import { openExternal } from '../utils/openExternal';

const FEEDBACK_EMAIL = 'feedback.pocketstudio@gmail.com';

function buildMailtoUrl(platform) {
  const subject = 'Pocket Studio Feedback';
  const body =
    "What would you like to share — a bug, an idea, or general feedback? Write below:\n\n\n\n" +
    `---\nApp version: ${__APP_VERSION__}\nPlatform: ${platform}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Opens the user's own mail client with a pre-filled draft — no backend
// needed, works for every friend regardless of whether they have a GitHub
// account. App version + platform are appended automatically so reports
// come with useful context without the user having to think of it.
export default function FeedbackButton({ platform }) {
  const [error, setError] = useState('');
  const mailtoUrl = buildMailtoUrl(platform);

  return (
    <>
      <a
        href={mailtoUrl}
        className="app__footer-info"
        onClick={(e) => openExternal(e, mailtoUrl, setError)}
      >
        Send Feedback
      </a>
      {error && <span className="app__footer-error">Couldn't open your mail app: {error}</span>}
    </>
  );
}
