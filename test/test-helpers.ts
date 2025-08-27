import {
  useEventCoreStore,
  useDocumentStore,
  useCollaborationStore,
} from "../app/stores";
import { generateId, type DocumentEvent } from "../app/event.types";

/**
 * Clean Test Helper Utilities
 * Organized by store domain with consistent patterns
 */

// Store access utilities - direct and focused
export const stores = {
  core: () => useEventCoreStore.getState(),
  document: () => useDocumentStore.getState(),
  collaboration: () => useCollaborationStore.getState(),
};

// Event utilities
export const events = {
  getAll: () => stores.core().events,
  getByType: (type: DocumentEvent["type"]) =>
    stores.core().events.filter((e) => e.type === type),
  getCount: () => stores.core().events.length,
  getCountByType: (type: DocumentEvent["type"]) =>
    events.getByType(type).length,
  getCountsByTypes: (types: DocumentEvent["type"][]) => {
    const result: Record<string, number> = {};
    types.forEach((type) => {
      result[type] = events.getCountByType(type);
    });
    return result;
  },
};

// State utilities
export const state = {
  get: () => stores.core().currentState,
  getVersion: () => stores.core().currentVersion,
  getUserId: () => stores.core().currentUserId,

  // Quick accessors
  blocks: {
    getAll: () => Array.from(state.get().blocks.values()),
    getById: (id: string) => state.get().blocks.get(id),
    getOrder: () => [...state.get().blockOrder],
    getCount: () => state.get().blocks.size,
  },

  users: {
    getAll: () => Array.from(state.get().users.values()),
    getActive: () => stores.collaboration().getActiveUsers(),
    getCount: () => state.get().users.size,
  },

  locks: {
    getAll: () => Array.from(state.get().locks.values()),
    getCount: () => state.get().locks.size,
    getByBlock: (blockId: string) =>
      stores.collaboration().getBlockLock(blockId),
  },

  drafts: {
    getAll: () => Array.from(state.get().drafts.values()),
    getCount: () => state.get().drafts.size,
    getByBlock: (blockId: string) => stores.collaboration().getDraft(blockId),
  },
};

// Setup utilities
export const setup = {
  reset: () => {
    useEventCoreStore.setState({
      events: [],
      currentVersion: 0,
      currentUserId: generateId(),
      currentState: setup.createInitialState(),
    });
  },

  createInitialState: () => ({
    document: {
      id: "doc-1",
      title: "Test Document",
      createdAt: Date.now(),
      lastModified: Date.now(),
    },
    blocks: new Map(),
    blockOrder: [],
    users: new Map(),
    locks: new Map(),
    drafts: new Map(),
    version: 0,
  }),

  setUser: (userId: string) => stores.core().setCurrentUser(userId),
};

// Factory utilities
export const create = {
  blocks: (count: number, prefix = "Block") => {
    const blockIds: string[] = [];
    for (let i = 0; i < count; i++) {
      stores.document().createBlock(`${prefix} ${i + 1}`);
      blockIds.push(state.blocks.getOrder()[i]);
    }
    return blockIds;
  },

  users: (names: string[]) => {
    return names.map((name) => {
      const userId = `user-${name.toLowerCase()}`;
      stores.collaboration().addUser(name, userId);
      return userId;
    });
  },

  userWithBlocks: (userName: string, blockCount: number) => {
    const [userId] = create.users([userName]);
    setup.setUser(userId);
    const blockIds = create.blocks(blockCount, `${userName} block`);
    return { userId, blockIds };
  },
};

// Action utilities - common workflows
export const actions = {
  editBlock: (blockId: string, content: string, commit = true) => {
    stores.collaboration().lockBlock(blockId);
    stores.collaboration().updateDraft(blockId, content);
    if (commit) {
      stores.collaboration().commitDraft(blockId);
      stores.collaboration().unlockBlock(blockId);
    }
    return blockId;
  },

  createAndEdit: (content: string, finalContent: string) => {
    stores.document().createBlock(content);
    const blockId = state.blocks.getOrder().at(-1)!;
    return actions.editBlock(blockId, finalContent);
  },

  lockAndDraft: (blockId: string, content: string, userId?: string) => {
    if (userId) setup.setUser(userId);
    stores.collaboration().lockBlock(blockId);
    stores.collaboration().updateDraft(blockId, content);
    return blockId;
  },
};

// Assertion utilities
export const expect = {
  blockOrder: (expectedContents: string[]) => {
    const blockOrder = state.blocks.getOrder();
    const blocks = state.get().blocks;

    expectedContents.forEach((content, index) => {
      const blockId = blockOrder[index];
      const block = blocks.get(blockId);
      if (block?.content !== content) {
        throw new Error(
          `Expected block at position ${index} to have content "${content}" but got "${block?.content}"`
        );
      }
    });
  },

  counts: (expected: {
    blocks?: number;
    events?: number;
    version?: number;
    locks?: number;
    drafts?: number;
    users?: number;
  }) => {
    const checks = [
      {
        name: "blocks",
        expected: expected.blocks,
        actual: state.blocks.getCount(),
      },
      { name: "events", expected: expected.events, actual: events.getCount() },
      {
        name: "version",
        expected: expected.version,
        actual: state.getVersion(),
      },
      {
        name: "locks",
        expected: expected.locks,
        actual: state.locks.getCount(),
      },
      {
        name: "drafts",
        expected: expected.drafts,
        actual: state.drafts.getCount(),
      },
      {
        name: "users",
        expected: expected.users,
        actual: state.users.getCount(),
      },
    ];

    checks.forEach(({ name, expected, actual }) => {
      if (expected !== undefined && actual !== expected) {
        throw new Error(`Expected ${expected} ${name} but got ${actual}`);
      }
    });
  },
};

// Performance utilities
export const perf = {
  measure: <T>(fn: () => T): { result: T; duration: number } => {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    return { result, duration: endTime - startTime };
  },
};

// Backward compatibility exports (deprecated - use new utilities above)
export const getStore = () => ({
  ...stores.core(),
  ...stores.document(),
  ...stores.collaboration(),
});

export const resetStore = setup.reset;
export const createTestBlocks = create.blocks;
export const createTestUsers = create.users;
export const getEventsByType = events.getByType;
export const getEventsCount = events.getCountsByTypes;
export const expectBlockOrder = expect.blockOrder;
export const expectStoreState = expect.counts;
export const createAndLockBlock = (content: string, userId?: string) => {
  if (userId) setup.setUser(userId);
  stores.document().createBlock(content);
  const blockOrder = state.blocks.getOrder();
  const blockId = blockOrder[blockOrder.length - 1];
  stores.collaboration().lockBlock(blockId);
  return blockId;
};
export const createEditAndCommitDraft = actions.createAndEdit;
export const measureTime = perf.measure;
