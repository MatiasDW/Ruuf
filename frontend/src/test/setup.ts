import "@testing-library/jest-dom/vitest";

// jsdom no implementa estos observers; framer-motion (IntersectionObserver) y
// Lenis (ResizeObserver) los requieren al montar AppShell/HomeView.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.IntersectionObserver ??= ObserverStub as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
