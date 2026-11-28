import { el, linesList, actionList } from './common.js';
import './creator.js'; // P5.6: loads the creator (window.gpCreator) with the start screen; main.js opens it after New Game

export function drawStart(panel, reply, onPress) {
  const s = reply.screen;
  panel.append(el('h1', { class: 'game-title', text: s.title }), // N437: big colored title (css/start.css)
    linesList(s.lines), actionList(s.actions, onPress));
}
