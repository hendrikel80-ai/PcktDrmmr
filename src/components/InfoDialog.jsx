import { useState } from 'react';
import { openExternal } from '../utils/openExternal';

const SOURCE_URL = 'https://github.com/hendrikel80-ai/PcktDrmmr';
const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
const CC_BY_URL = 'https://creativecommons.org/licenses/by/3.0/';

// Links inside the modal need openExternal (see utils/openExternal.js) —
// the backdrop's stopPropagation keeps the opener plugin from seeing them.
function ExternalLink({ href, onError, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => openExternal(e, href, onError)}>
      {children}
    </a>
  );
}

// Privacy + credits notice, reachable via a real button in the footer
// (both Desktop and Mobile) — not just a hover tooltip like the earlier
// kit attribution, which was effectively unreachable on touch devices.
// Reuses the sound-like-modal classes instead of inventing new CSS (see
// SoundLike.jsx).
export default function InfoDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [linkError, setLinkError] = useState('');

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
              <h4>License</h4>
              <p>
                Pocket Studio is free software, licensed under the{' '}
                <ExternalLink onError={setLinkError} href={GPL_URL}>GNU General Public License version 3</ExternalLink>{' '}
                (GPL-3.0-only). It comes with ABSOLUTELY NO WARRANTY. You may redistribute and
                modify it under the terms of that license.
              </p>
              <p>
                Source code: <ExternalLink onError={setLinkError} href={SOURCE_URL}>github.com/hendrikel80-ai/PcktDrmmr</ExternalLink>
              </p>
            </section>

            <section className="info-dialog__section">
              <h4>Credits &amp; Licenses</h4>
              <ul>
                <li>
                  <strong>Acoustic drum kit:</strong> "Pearl Master Studio Pack 1" by enoe
                  (oramics/sampled), licensed under{' '}
                  <ExternalLink onError={setLinkError} href={CC_BY_URL}>CC-BY 3.0</ExternalLink>.
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
                <li>
                  <strong>Audio interface support:</strong> Steinberg ASIO SDK, used under GPLv3.
                  ASIO is a trademark of Steinberg Media Technologies GmbH, registered in Europe and
                  other countries.
                </li>
                <li>
                  <strong>MP3 encoding:</strong> LAME (via mp3lame-encoder and lamejs), licensed
                  under the GNU LGPL.
                </li>
              </ul>
              <p>Full third-party notices: NOTICE.md in the installation folder and the source code.</p>
              {linkError && <p className="sound-like-modal__link-error">Couldn't open the browser: {linkError}</p>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
