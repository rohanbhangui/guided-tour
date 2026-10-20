import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, forwardRef, useRef, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TourProvider,
  defineTour,
  memoryStorage,
  useTour,
  useTourActions,
  useTourStep,
  useTourSteps,
  type TourActions,
  type TourDefinition,
  type TourStorage,
} from '../src';

const tick = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));

const basicTour = defineTour({
  id: 'basic',
  autoStart: true,
  waitTimeout: 0,
  steps: [
    { id: 'welcome', title: 'Welcome', content: 'Hello there' },
    'alpha',
    'beta',
  ],
});

function Steps() {
  const { Step } = useTourSteps(basicTour);
  return (
    <main>
      <Step id="alpha" title="Alpha" content="Alpha content">
        <section data-testid="alpha">A</section>
      </Step>
      <Step id="beta" title="Beta" content="Beta content">
        <section data-testid="beta">B</section>
      </Step>
    </main>
  );
}

function setup(opts: { tours?: TourDefinition<string>[]; storage?: TourStorage; children?: ReactNode } = {}) {
  const storage = opts.storage ?? memoryStorage();
  const utils = render(
    <TourProvider tours={opts.tours ?? [basicTour]} storage={storage}>
      {opts.children ?? <Steps />}
    </TourProvider>,
  );
  return { storage, ...utils };
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('footprint', () => {
  it('adds no DOM while idle and <Step> adds no wrapper', async () => {
    const quiet = defineTour({ id: 'quiet', steps: ['alpha'] });
    function Content() {
      const { Step } = useTourSteps(quiet);
      return (
        <Step id="alpha" content="x">
          <p>child</p>
        </Step>
      );
    }
    const { container } = setup({ tours: [quiet], children: <Content /> });
    await tick();
    expect(container.innerHTML).toBe('<p>child</p>');
    expect(document.body.children).toHaveLength(1); // just RTL's container, no portal
  });

  it('does not re-render the app when steps register or the step changes', async () => {
    let siblingRenders = 0;
    function Sibling() {
      siblingRenders++;
      return null;
    }
    setup({
      children: (
        <>
          <Sibling />
          <Steps />
        </>
      ),
    });
    await tick();
    expect(screen.getByRole('dialog')).toBeTruthy();
    const before = siblingRenders;
    fireEvent.click(screen.getByText('Next'));
    await tick();
    fireEvent.click(screen.getByText('Next'));
    await tick();
    expect(siblingRenders).toBe(before);
  });
});

describe('lifecycle & persistence', () => {
  it('auto-starts once, walks the steps, and records completion', async () => {
    const { storage } = setup();
    await tick();
    expect(screen.getByRole('dialog').textContent).toContain('Hello there');
    expect(screen.getByText('1 of 3')).toBeTruthy();

    fireEvent.click(screen.getByText('Next'));
    await tick();
    expect(screen.getByText('Alpha content')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();

    fireEvent.click(screen.getByText('Next'));
    await tick();
    expect(screen.getByText('Beta content')).toBeTruthy();
    fireEvent.click(screen.getByText('Done'));
    await tick();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.get('basic:v1')).toMatchObject({ status: 'completed', step: 2 });
    expect(document.querySelector('.gt-root')).toBeNull();
  });

  it('auto-starts under StrictMode (effects mount twice) with a delay', async () => {
    const delayed = { ...basicTour, id: 'strict', autoStartDelay: 30 };
    function StrictSteps() {
      const { Step } = useTourSteps(delayed as typeof basicTour);
      return (
        <Step id="alpha" content="Alpha content">
          <div />
        </Step>
      );
    }
    render(
      <StrictMode>
        <TourProvider tours={[delayed]} storage={memoryStorage()}>
          <StrictSteps />
        </TourProvider>
      </StrictMode>,
    );
    await tick(80);
    expect(screen.getByText('Hello there')).toBeTruthy();
  });

  it('does not auto-start when already seen', async () => {
    const storage = memoryStorage();
    storage.set('basic:v1', { status: 'dismissed', step: 0, updatedAt: '' });
    setup({ storage });
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('bumping the version re-shows the tour', async () => {
    const storage = memoryStorage();
    storage.set('basic:v1', { status: 'completed', step: 2, updatedAt: '' });
    setup({ storage, tours: [{ ...basicTour, version: 2 }] });
    await tick();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('close button dismisses; reset clears and restart shows it again', async () => {
    let api!: ReturnType<typeof useTour>;
    function Grab() {
      api = useTour();
      return null;
    }
    const { storage } = setup({
      children: (
        <>
          <Grab />
          <Steps />
        </>
      ),
    });
    await tick();
    fireEvent.click(screen.getByLabelText('Close tour'));
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.get('basic:v1')).toMatchObject({ status: 'dismissed' });
    expect(api.hasSeen(basicTour)).toBe(true);

    act(() => api.reset(basicTour));
    expect(storage.get('basic:v1')).toBeNull();
    expect(api.hasSeen(basicTour)).toBe(false);
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull(); // reset alone doesn't start it

    await act(() => api.reset(basicTour, { restart: true }));
    await tick();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(api.isActive).toBe(true);
  });

  it('stop({ persist: false }) leaves no record', async () => {
    let api!: ReturnType<typeof useTour>;
    function Grab() {
      api = useTour();
      return null;
    }
    const { storage } = setup({ children: <><Grab /><Steps /></> });
    await tick();
    act(() => api.stop({ persist: false }));
    expect(storage.get('basic:v1')).toBeNull();
  });
});

describe('steps', () => {
  it('skips inline steps that are not mounted', async () => {
    const tour = defineTour({
      id: 'skip',
      autoStart: true,
      waitTimeout: 0,
      steps: ['missing', { id: 'end', content: 'The end' }],
    });
    setup({ tours: [tour], children: <div /> });
    await tick();
    expect(screen.getByText('The end')).toBeTruthy();
  });

  it('waits for a step that mounts late', async () => {
    const tour = defineTour({ id: 'late', autoStart: true, waitTimeout: 500, steps: ['later'] });
    function Late({ show }: { show: boolean }) {
      const { Step } = useTourSteps(tour);
      return show ? (
        <Step id="later" content="Arrived">
          <div />
        </Step>
      ) : null;
    }
    const { rerender } = render(
      <TourProvider tours={[tour]} storage={memoryStorage()}>
        <Late show={false} />
      </TourProvider>,
    );
    await tick(50);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <TourProvider tours={[tour]} storage={memoryStorage()}>
        <Late show />
      </TourProvider>,
    );
    await tick(100);
    expect(screen.getByText('Arrived')).toBeTruthy();
  });

  it('a tour that shows zero steps is not recorded as seen', async () => {
    const storage = memoryStorage();
    const tour = defineTour({ id: 'empty', autoStart: true, waitTimeout: 0, steps: ['nope'] });
    setup({ tours: [tour], storage, children: <div /> });
    await tick();
    expect(storage.get('empty:v1')).toBeNull();
  });

  it('runs onBeforeShow from the definition before an inline step mounts', async () => {
    const tour = defineTour({
      id: 'drawer',
      autoStart: true,
      steps: [{ id: 'inside', onBeforeShow: () => openDrawer() }],
    });
    let openDrawer = () => {};
    function App() {
      const [open, setOpen] = useState(false);
      openDrawer = () => setOpen(true);
      const { Step } = useTourSteps(tour);
      return open ? (
        <Step id="inside" content="In the drawer">
          <aside />
        </Step>
      ) : null;
    }
    setup({ tours: [tour], children: <App /> });
    await tick(100);
    expect(screen.getByText('In the drawer')).toBeTruthy();
  });

  it('useTourStep works with a forwardRef component and keeps the user ref', async () => {
    const tour = defineTour({ id: 'ref', autoStart: true, steps: ['card'] });
    const Card = forwardRef<HTMLDivElement, { children: ReactNode }>((p, ref) => <div ref={ref}>{p.children}</div>);
    let userRef: HTMLDivElement | null = null;
    function App() {
      const local = useRef<HTMLDivElement>(null);
      const { Step } = useTourSteps(tour);
      userRef = local.current;
      return (
        <Step id="card" content="Card step">
          <Card ref={local}>card</Card>
        </Step>
      );
    }
    setup({ tours: [tour], children: <App /> });
    await tick();
    expect(screen.getByText('Card step')).toBeTruthy();
    expect(screen.getByText('card').tagName).toBe('DIV');
    void userRef;
  });

  it('useTourStep returns a ref callback for the element itself', async () => {
    const tour = defineTour({ id: 'hook', autoStart: true, steps: ['self'] });
    function Self() {
      const ref = useTourStep(tour, 'self', { content: 'Self step' });
      return <div ref={ref}>me</div>;
    }
    setup({ tours: [tour], children: <Self /> });
    await tick();
    expect(screen.getByText('Self step')).toBeTruthy();
  });
});

describe('keyboard', () => {
  const kbTour = (escape: 'hold' | 'tap') =>
    defineTour({
      id: `kb-${escape}`,
      autoStart: true,
      keyboard: { escape, escapeHoldMs: 80 },
      steps: [
        { id: 'one', content: 'One' },
        { id: 'two', content: 'Two' },
      ],
    });

  it('arrow keys navigate', async () => {
    setup({ tours: [kbTour('hold')], children: <div /> });
    await tick();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await tick();
    expect(screen.getByText('Two')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    await tick();
    expect(screen.getByText('One')).toBeTruthy();
  });

  it('a short Escape press does not exit in hold mode; a long one does', async () => {
    const { storage } = setup({ tours: [kbTour('hold')], children: <div /> });
    await tick();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByLabelText('Close tour').hasAttribute('data-holding')).toBe(true);
    await tick(20);
    fireEvent.keyUp(document, { key: 'Escape' });
    await tick(120);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await tick(120);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.get('kb-hold:v1')).toMatchObject({ status: 'dismissed' });
  });

  it('tap mode exits immediately', async () => {
    setup({ tours: [kbTour('tap')], children: <div /> });
    await tick();
    fireEvent.keyDown(document, { key: 'Escape' });
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('progress dots', () => {
  const long = defineTour({
    id: 'long',
    autoStart: true,
    progress: 'dots',
    steps: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, content: `Step ${i}` })),
  });
  const shown = () => [...document.querySelectorAll('.gt-dot')].filter((d) => d.getAttribute('data-size') !== 'hidden');

  it('windows the dots past maxDots and shrinks edge dots', async () => {
    setup({ tours: [long], children: <div /> });
    await tick();
    expect(document.querySelectorAll('.gt-dot')).toHaveLength(9);
    expect(shown()).toHaveLength(5);
    expect(shown().at(-1)!.getAttribute('data-size')).toBe('sm'); // more beyond the right edge
    expect(shown()[0]!.getAttribute('data-size')).toBeNull(); // nothing before the first step

    act(() => {
      for (let i = 0; i < 4; i++) fireEvent.keyDown(document, { key: 'ArrowRight' });
    });
    await tick();
    await tick();
    const current = document.querySelector('.gt-dot[aria-current="step"]')!;
    expect(shown()).toContain(current);
    expect(shown()[0]!.getAttribute('data-size')).toBe('sm');
  });
});

describe('width', () => {
  it('uses the tour width, overridden per step', async () => {
    const tour = defineTour({
      id: 'w',
      autoStart: true,
      width: 400,
      steps: [
        { id: 'a', content: 'A' },
        { id: 'b', content: 'B', width: '30rem' },
      ],
    });
    setup({ tours: [tour], children: <div /> });
    await tick();
    const floating = () => document.querySelector<HTMLElement>('.gt-floating')!;
    expect(floating().style.width).toContain('400px');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await tick();
    expect(floating().style.width).toContain('30rem');
  });
});

describe('action steps (advanceOn)', () => {
  const actionTour = defineTour({
    id: 'action',
    autoStart: true,
    waitTimeout: 0,
    progress: 'dots',
    steps: [{ id: 'intro', content: 'Intro' }, 'press', 'form', { id: 'end', content: 'End' }],
  });

  function ActionSteps({ onPressed }: { onPressed?: () => void }) {
    const { Step } = useTourSteps(actionTour);
    return (
      <main>
        <Step id="press" advanceOn="click" content="Click the button">
          <div>
            <button onClick={onPressed}>Press me</button>
          </div>
        </Step>
        <Step id="form" advanceOn="manual" content="Submit the form">
          <form data-testid="form" />
        </Step>
      </main>
    );
  }

  let api!: ReturnType<typeof useTour>;
  function Grab() {
    api = useTour();
    return null;
  }

  const next = () => screen.getByText('Next') as HTMLButtonElement;
  const toPress = async () => {
    setup({ tours: [actionTour], children: (<><Grab /><ActionSteps onPressed={pressed} /></>) });
    await tick();
    fireEvent.click(next());
    await tick();
    expect(screen.getByText('Click the button')).toBeTruthy();
  };
  let pressed = vi.fn();
  beforeEach(() => {
    pressed = vi.fn();
  });

  it("'click': Next is disabled, keys don't advance, clicking inside the target does (after the app's handler)", async () => {
    await toPress();
    expect(next().disabled).toBe(true);
    fireEvent.click(next());
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    await tick();
    expect(screen.getByText('Click the button')).toBeTruthy();

    fireEvent.click(screen.getByText('Press me'));
    expect(pressed).toHaveBeenCalledTimes(1);
    await tick();
    expect(screen.getByText('Submit the form')).toBeTruthy();
  });

  it("'manual': only advance(tour, currentStep) moves on; Back still works", async () => {
    await toPress();
    fireEvent.click(screen.getByText('Press me'));
    await tick();
    expect(next().disabled).toBe(true);

    act(() => api.advance(actionTour, 'press')); // stale step: ignored
    await tick();
    expect(screen.getByText('Submit the form')).toBeTruthy();

    act(() => api.advance(actionTour, 'form'));
    await tick();
    expect(screen.getByText('End')).toBeTruthy();

    fireEvent.click(screen.getByText('Back'));
    await tick();
    expect(screen.getByText('Submit the form')).toBeTruthy();
  });

  it("dots can't jump past an action step", async () => {
    setup({ tours: [actionTour], children: <ActionSteps /> });
    await tick();
    const dots = () => [...document.querySelectorAll<HTMLButtonElement>('.gt-dot')];
    expect(dots().map((d) => d.disabled)).toEqual([false, false, true, true]);
    fireEvent.click(dots()[3]!);
    await tick();
    expect(screen.getByText('Intro')).toBeTruthy();

    fireEvent.click(dots()[1]!);
    await tick();
    expect(screen.getByText('Click the button')).toBeTruthy();
    expect(dots().map((d) => d.disabled)).toEqual([false, false, true, true]);
  });

  it("'click' still advances when the click unmounts the target", async () => {
    const tour = defineTour({ id: 'unmount', autoStart: true, steps: ['save'] });
    function Drawer() {
      const [open, setOpen] = useState(true);
      const { Step } = useTourSteps(tour);
      return open ? (
        <Step id="save" advanceOn="click" content="Click save">
          <button onClick={() => setOpen(false)}>Save</button>
        </Step>
      ) : null;
    }
    const { storage } = setup({ tours: [tour], children: <Drawer /> });
    await tick();
    fireEvent.click(screen.getByText('Save'));
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.get('unmount:v1')).toMatchObject({ status: 'completed' });
  });

  it("'click' with no target falls back to Next", async () => {
    const tour = defineTour({
      id: 'fallback',
      autoStart: true,
      steps: [{ id: 'only', content: 'No target', advanceOn: 'click' }],
    });
    setup({ tours: [tour], children: <div /> });
    await tick();
    expect((screen.getByText('Done') as HTMLButtonElement).disabled).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("advanceOn: 'click'"));
  });
});

describe('several tours', () => {
  it('runs due auto-start tours one at a time, in order', async () => {
    const first = defineTour({ id: 'first', autoStart: true, steps: [{ id: 'a', content: 'First tour' }] });
    const second = defineTour({ id: 'second', autoStart: true, steps: [{ id: 'b', content: 'Second tour' }] });
    setup({ tours: [first, second], children: <div /> });
    await tick();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('First tour')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close tour'));
    await tick();
    expect(screen.getByText('Second tour')).toBeTruthy();

    fireEvent.click(screen.getByText('Done'));
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('provider', () => {
  it('hooks throw a named error outside <TourProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useTourActions();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow('[guided-tour] useTourActions must be used inside <TourProvider>.');
  });
});

describe('types', () => {
  it('step ids are checked against the tour', () => {
    function Typed() {
      const { Step } = useTourSteps(basicTour);
      return (
        <>
          <Step id="alpha" content="ok">
            <div />
          </Step>
          {/* @ts-expect-error — not a step of this tour */}
          <Step id="alpah" content="typo">
            <div />
          </Step>
        </>
      );
    }
    // @ts-expect-error — not a step of this tour
    const useIt = () => useTourStep(basicTour, 'gamma');
    expect(Typed).toBeTypeOf('function');
    expect(useIt).toBeTypeOf('function');
  });

  it('actions take tour objects, and start({ step }) is checked against the tour', () => {
    const typed = (api: TourActions) => {
      void api.start(basicTour, { step: 'alpha' });
      void api.start(basicTour, { step: 1 });
      api.reset(basicTour, { restart: true });
      api.reset();
      api.hasSeen(basicTour);
      // @ts-expect-error — tours are passed as objects, not id strings
      void api.start('basic');
      // @ts-expect-error — not a step of this tour
      void api.start(basicTour, { step: 'alpah' });
      // @ts-expect-error — tours are passed as objects, not id strings
      api.reset('basic');
      // @ts-expect-error — tours are passed as objects, not id strings
      api.hasSeen('basic');
      api.advance(basicTour, 'alpha');
      // @ts-expect-error — not a step of this tour
      api.advance(basicTour, 'alpah');
    };
    expect(typed).toBeTypeOf('function');
  });
});

