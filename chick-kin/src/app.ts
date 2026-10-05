import './ui/ui.css';
import { GameFlow } from './core/GameFlow';

export function startApp(stage: HTMLElement, ui: HTMLElement) {
  new GameFlow(stage, ui);
}
