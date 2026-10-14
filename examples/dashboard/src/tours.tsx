import { defineTour } from 'guided-tour';

/**
 * The app wires these up on mount. Tours are module-level constants, so
 * anything they need to *do* to the UI (open a drawer) goes through here.
 */
export const ui = {
  openSettings: () => {},
  closeSettings: () => {},
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const introTour = defineTour({
  id: 'dashboard-intro',
  autoStart: true,
  autoStartDelay: 400,
  progress: 'both',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Acme Analytics 👋',
      content: "Here's a 30-second look around. Use ← → to move, or hold Esc to skip.",
    },
    'sidebar',
    'search',
    'kpis',
    'revenue-chart',
    'orders-table',
    'activity',
    'help-menu',
    {
      id: 'done',
      title: "You're all set",
      content: 'You can replay this tour, or take the deeper ones, from the Help menu anytime.',
      nextLabel: "Let's go",
    },
  ],
});

export const ordersTour = defineTour({
  id: 'orders-table',
  progress: 'dots',
  steps: ['orders-search', 'orders-filters', 'orders-sort', 'orders-actions', 'orders-pagination'],
});

export const settingsTour = defineTour({
  id: 'settings',
  progress: 'counter',
  steps: [
    // No content here: the inline step supplies it. This entry only exists so the
    // drawer opens *before* the step (which lives inside the drawer) mounts.
    {
      id: 'settings-theme',
      onBeforeShow: async () => {
        ui.openSettings();
        await wait(250); // let the slide-in finish so positioning starts from the final spot
      },
    },
    'settings-notifications',
    'settings-save',
  ],
  onComplete: () => ui.closeSettings(),
  onDismiss: () => ui.closeSettings(),
});

export const tours = [introTour, ordersTour, settingsTour];
