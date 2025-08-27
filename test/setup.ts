// Global test setup
import { beforeEach, afterEach, vi } from "vitest";

// Mock timers for testing debounced operations
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
