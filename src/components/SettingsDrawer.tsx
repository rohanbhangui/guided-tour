import { useTourActions, useTourSteps } from 'guided-tour';
import { useState } from 'react';
import { settingsTour } from '../tours';
import { Icon } from './Icon';

export type Theme = 'system' | 'light' | 'dark';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}

export function SettingsDrawer({ open, onClose, theme, onTheme }: SettingsDrawerProps) {
  const { Step } = useTourSteps(settingsTour);
  const { start } = useTourActions();
  const [emails, setEmails] = useState({ orders: true, refunds: true, weekly: false });

  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Settings">
        <div className="drawer-head">
          <h2>Settings</h2>
          <div>
            <button className="icon-button" aria-label="Settings tour" onClick={() => start('settings')}>
              <Icon name="help" />
            </button>
            <button className="icon-button" aria-label="Close settings" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
        </div>

        <Step
          id="settings-theme"
          title="Appearance"
          content="Pick light, dark, or follow your system. The tour itself follows the system theme too."
          placement="left"
        >
          <fieldset className="field">
            <legend>Theme</legend>
            <div className="segmented">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button key={t} aria-pressed={theme === t} onClick={() => onTheme(t)}>
                  {t[0]!.toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>
        </Step>

        <Step
          id="settings-notifications"
          title="Email notifications"
          content="Choose which events land in your inbox."
          placement="left"
        >
          <fieldset className="field">
            <legend>Email me about</legend>
            {(Object.keys(emails) as (keyof typeof emails)[]).map((k) => (
              <label key={k} className="check">
                <input type="checkbox" checked={emails[k]} onChange={(e) => setEmails({ ...emails, [k]: e.target.checked })} />
                {{ orders: 'New orders', refunds: 'Refund requests', weekly: 'Weekly summary' }[k]}
              </label>
            ))}
          </fieldset>
        </Step>

        <div className="drawer-foot">
          <Step id="settings-save" title="Save" content="Changes apply as soon as you save." placement="top-end">
            <button className="button primary" onClick={onClose}>
              Save changes
            </button>
          </Step>
        </div>
      </aside>
    </>
  );
}
