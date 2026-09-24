import { useState } from 'react';

// Privacy + credits notice, reachable via a real button in the footer
// (both Desktop and Mobile) — not just a hover tooltip like the earlier
// kit attribution, which was effectively unreachable on touch devices.
// Reuses the sound-like-modal classes instead of inventing new CSS (see
// SoundLike.jsx).
export default function InfoDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" className="app__footer-info" onClick={() => setIsOpen(true)}>
        Privacy &amp; Credits
      </button>

      {isOpen && (
        <div className="sound-like-modal__backdrop" onClick={() => setIsOpen(false)}>
          <div className="sound-like-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sound-like-modal__header">
              <h3>Privacy &amp; Credits</h3>
              <button
                type="button"
                className="sound-like-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <section className="info-dialog__section">
              <h4>Privacy</h4>
              <p>
                Pocket Studio runs locally on your device. Recordings (guitar, microphone, drums)
                never leave your device and are stored locally only.
              </p>
              <p>
                Two features send data to an AI provider (Anthropic or DeepSeek, depending on
                server configuration):
              </p>
              <ul>
                <li>
                  <strong>Generate a Beat</strong> sends your text prompt and, where available, a
                  few saved reference patterns to create a drum pattern.
                </li>
                <li>
                  <strong>Sound Like</strong> sends the musician/band name you searched for, to
                  research matching amp gear on the web.
                </li>
              </ul>
              <p>No audio data is ever uploaded — only the respective text prompt.</p>
            </section>

            <section className="info-dialog__section">
              <h4>Credits &amp; Licenses</h4>
              <ul>
                <li>
                  <strong>Acoustic drum kit:</strong> "Pearl Master Studio Pack 1" by enoe
                  (oramics/sampled), licensed under{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/3.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CC-BY 3.0
                  </a>
                  .
                </li>
                <li>
                  <strong>Trap/vintage kits:</strong> samples from Boochi44/free-drum-samples
                  (partly based on Edward Loveall's TR-808 library), licensed under CC0 1.0 — no
                  attribution required, documented here anyway.
                </li>
                <li>
                  <strong>Amp modeling:</strong> Neural Amp Modeler Core by Steven Atkinson,
                  licensed under the MIT License.
                </li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
