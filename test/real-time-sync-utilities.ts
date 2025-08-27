import {
  useEventCoreStore,
  useDocumentStore,
  useCollaborationStore,
} from "../app/stores";
import type { DocumentEvent } from "../app/event.types";
import { setup } from "./test-helpers";

/**
 * Multi-Tab Simulation for Real-Time Sync POC
 * Simulates multiple browser tabs/users sharing events in real-time
 */

export interface TabInstance {
  id: string;
  userId: string;
  userName: string;

  // Store access
  core: ReturnType<typeof useEventCoreStore.getState>;
  document: ReturnType<typeof useDocumentStore.getState>;
  collaboration: ReturnType<typeof useCollaborationStore.getState>;

  // Tab-specific operations
  dispatch: (eventData: {
    type: DocumentEvent["type"];
    payload: DocumentEvent["payload"];
  }) => void;
  getCurrentState: () => ReturnType<
    typeof useEventCoreStore.getState
  >["currentState"];
  getEvents: () => DocumentEvent[];
}

export class MockCollaborativeSession {
  private tabs: Map<string, TabInstance> = new Map();
  private globalEventLog: DocumentEvent[] = [];
  private eventListeners: ((
    event: DocumentEvent,
    fromTabId: string
  ) => void)[] = [];

  constructor() {
    // Initialize with clean state
    setup.reset();
  }

  /**
   * Create a new tab instance (simulates opening a new browser tab)
   */
  createTab(tabId: string, userName: string): TabInstance {
    // Each tab gets its own user ID but shares the same store instances
    const userId = `user-${userName.toLowerCase()}-${tabId}`;

    // Set up the user in the system (set user context first)
    useEventCoreStore.getState().setCurrentUser(userId);
    useCollaborationStore.getState().addUser(userName, userId);

    const tabInstance: TabInstance = {
      id: tabId,
      userId,
      userName,

      // Store access (shared across tabs for POC)
      get core() {
        return useEventCoreStore.getState();
      },
      get document() {
        return useDocumentStore.getState();
      },
      get collaboration() {
        return useCollaborationStore.getState();
      },

      // Simplified dispatch (no broadcasting for now to avoid infinite loops)
      dispatch: (eventData) => {
        // Set current user context for this tab
        useEventCoreStore.getState().setCurrentUser(userId);

        // Dispatch the event locally (this already updates all tabs since they share the store)
        useEventCoreStore.getState().dispatch(eventData);
      },

      getCurrentState: () => useEventCoreStore.getState().currentState,
      getEvents: () => useEventCoreStore.getState().events,
    };

    this.tabs.set(tabId, tabInstance);
    return tabInstance;
  }

  /**
   * Broadcast an event to all other tabs (simulates real-time sync)
   */
  private broadcastEvent(event: DocumentEvent, fromTabId: string) {
    // Add to global log
    this.globalEventLog.push(event);

    // Sync to all other tabs
    this.tabs.forEach((_, tabId) => {
      if (tabId !== fromTabId) {
        // Simulate receiving external event
        useEventCoreStore.getState().syncExternalEvent(event);
      }
    });

    // Notify listeners
    this.eventListeners.forEach((listener) => {
      listener(event, fromTabId);
    });
  }

  /**
   * Get a specific tab instance
   */
  getTab(tabId: string): TabInstance | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get all active tabs
   */
  getAllTabs(): TabInstance[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Switch context to a specific tab (simulates clicking on a tab)
   */
  switchToTab(tabId: string): TabInstance {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    // Set current user context
    useEventCoreStore.getState().setCurrentUser(tab.userId);
    return tab;
  }

  /**
   * Get global event log (shows all events from all tabs)
   */
  getGlobalEventLog(): DocumentEvent[] {
    return [...this.globalEventLog];
  }

  /**
   * Add event listener for testing
   */
  onEvent(listener: (event: DocumentEvent, fromTabId: string) => void) {
    this.eventListeners.push(listener);
  }

  /**
   * Simulate network delay (for testing edge cases)
   */
  async simulateDelay(ms: number = 100): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verify all tabs have consistent state
   */
  verifyConsistency(): boolean {
    if (this.tabs.size === 0) return true;

    const states = Array.from(this.tabs.values()).map((tab) =>
      tab.getCurrentState()
    );
    const firstState = states[0];

    return states.every(
      (state) =>
        state.blocks.size === firstState.blocks.size &&
        state.version === firstState.version &&
        state.blockOrder.length === firstState.blockOrder.length
    );
  }

  /**
   * Clean up all tabs
   */
  cleanup() {
    this.tabs.clear();
    this.globalEventLog = [];
    this.eventListeners = [];
    setup.reset();
  }
}

// Helper functions for easier testing
export const createCollaborativeSession = () => new MockCollaborativeSession();

export const simulateUserAction = (
  tab: TabInstance,
  action: () => void
): void => {
  // Switch to tab context
  useEventCoreStore.getState().setCurrentUser(tab.userId);

  // Perform action
  action();
};
