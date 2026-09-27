import type { CaptionSpeaker, InfoItem } from '../math/bridge';
import type { FaceState } from '../math/states';

export interface Overlay {
  caption(who: CaptionSpeaker, text: string, final: boolean): void;
  info(items: InfoItem[]): void;
  setState(state: FaceState): void;
  destroy(): void;
}

/** How long a finished caption lingers before fading, in ms. */
const CAPTION_LINGER = 6000;

/**
 * Quiet text layer over the face: fading captions under the orb, and a small
 * glanceable list (next meeting, important mail) shown only while idle.
 * Styling comes from the page's CSS classes (.face-captions, .face-info), so colours stay in tokens.
 */
export function createOverlay(parent: HTMLElement = document.body): Overlay {
  const captions = document.createElement('div');
  captions.className = 'face-captions';
  // Captions are decorative here: the live region already announces state, and
  // re-announcing every streamed word would flood a screen reader.
  captions.setAttribute('aria-hidden', 'true');
  const lines: Record<CaptionSpeaker, HTMLParagraphElement> = {
    user: Object.assign(document.createElement('p'), { className: 'face-caption face-caption-user' }),
    monk: Object.assign(document.createElement('p'), { className: 'face-caption face-caption-monk' }),
  };
  captions.append(lines.user, lines.monk);

  const info = document.createElement('ul');
  info.className = 'face-info';
  info.setAttribute('aria-label', 'Up next');

  parent.append(captions, info);
  const timers: Partial<Record<CaptionSpeaker, number>> = {};
  let infoItems: InfoItem[] = [];
  let state: FaceState = 'idle';

  const renderInfo = (): void => {
    info.replaceChildren(...infoItems.map((it) => {
      const li = document.createElement('li');
      li.className = `face-info-${it.kind}`;
      li.textContent = it.text;
      return li;
    }));
    info.classList.toggle('visible', state === 'idle' && infoItems.length > 0);
  };

  return {
    caption(who, text, final) {
      const el = lines[who];
      el.textContent = text;
      el.classList.add('visible');
      clearTimeout(timers[who]);
      // A new user line starts a new exchange: clear Monk's previous reply.
      if (who === 'user') {
        lines.monk.classList.remove('visible');
        clearTimeout(timers.monk);
      }
      if (final) timers[who] = window.setTimeout(() => el.classList.remove('visible'), CAPTION_LINGER);
    },
    info(items) {
      infoItems = items;
      renderInfo();
    },
    setState(s) {
      state = s;
      renderInfo();
    },
    destroy() {
      clearTimeout(timers.user);
      clearTimeout(timers.monk);
      captions.remove();
      info.remove();
    },
  };
}
