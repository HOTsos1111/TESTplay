import './style.css';
import './ui/fonts';
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage')!;
if (params.get('view') === 'models') {
  import('./viewer').then((m) => m.startViewer(stage));
} else {
  import('./app').then((m) => m.startApp(stage, document.getElementById('ui')!));
}
