import {mountGlassNavigation} from './glass-navigation.mjs';

// Adapt existing account preferences; the shared controller owns no storage or routes.
const root = document.documentElement;
const tray = document.querySelector('.labTabs');
let navigation;
const appearance = () => {
  root.dataset.wataMenuMaterial = root.classList.contains('slr-no-glass') ? 'solid' : 'glass';
  root.dataset.wataMenuSelection = root.classList.contains('slr-filled-selection') ? 'accent' : 'black';
};
const observer = new MutationObserver(appearance);
function mount() {
  appearance();
  observer.observe(root, {attributes:true, attributeFilter:['class']});
  tray?.querySelectorAll('[role="tab"]').forEach(button => {button.dataset.wataMenuNav = '';});
  navigation = mountGlassNavigation(tray);
  // Commands receive the housing material, never release-to-select behavior.
  const commands = document.querySelector('.dockGroup');
  if (commands) {commands.dataset.wataGlassHousing = ''; commands.dataset.wataMenuSurface = '';}
}
window.addEventListener('pagehide', () => {observer.disconnect(); navigation?.destroy();});
window.addEventListener('pageshow', mount);
mount();
