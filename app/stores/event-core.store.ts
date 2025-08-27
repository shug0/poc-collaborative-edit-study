import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { DocumentEvent, DocumentState } from "../collaboration.types";
import { generateId } from "../event.types";

/**
 * Core Event Sourcing Store
 * Handles: Event log, dispatch, versioning, state projection
 */
interface EventCoreStore {
  // Event log - single source of truth
  events: DocumentEvent[];
  currentVersion: number;

  // Derived state (cached projections)
  currentState: DocumentState;

  // Current user context
  currentUserId: string;

  // Core event operations
  dispatch: (eventData: {
    type: DocumentEvent["type"];
    payload: DocumentEvent["payload"];
  }) => void;

  // Real-time sync operations
  syncExternalEvent: (event: DocumentEvent) => void;

  // State management
  replayEvents: () => void;
  setCurrentUser: (userId: string) => void;

  // Internal state access
  getState: () => DocumentState;
  getEvents: () => DocumentEvent[];
}

// Event reducer - derives state from events
function reduceEvents(events: DocumentEvent[]): DocumentState {
  const state: DocumentState = {
    document: {
      id: "doc-1",
      title: "Collaborative Document",
      createdAt: Date.now(),
      lastModified: Date.now(),
    },
    blocks: new Map(),
    blockOrder: [],
    users: new Map(),
    locks: new Map(),
    drafts: new Map(),
    version: 0,
  };

  for (const event of events) {
    state.version = Math.max(state.version, event.version);

    switch (event.type) {
      case "DOCUMENT_CREATED": {
        if (event.type === "DOCUMENT_CREATED") {
          const { title, createdAt } = event.payload;
          state.document = {
            ...state.document,
            title,
            createdAt,
          };
        }
        break;
      }

      case "BLOCK_CREATED": {
        if (event.type === "BLOCK_CREATED") {
          const { blockId, content, position } = event.payload;
          const block = {
            id: blockId,
            content,
            position,
            createdAt: event.timestamp,
            lastModified: event.timestamp,
            lastEditedBy: event.userId,
          };
          state.blocks.set(blockId, block);

          // Insert in order
          if (position >= state.blockOrder.length) {
            state.blockOrder.push(blockId);
          } else {
            state.blockOrder.splice(position, 0, blockId);
          }
        }
        break;
      }

      case "BLOCK_CONTENT_CHANGED": {
        if (event.type === "BLOCK_CONTENT_CHANGED") {
          const { blockId, content } = event.payload;
          const block = state.blocks.get(blockId);
          if (block) {
            state.blocks.set(blockId, {
              ...block,
              content,
              lastModified: event.timestamp,
              lastEditedBy: event.userId,
            });
          }
        }
        break;
      }

      case "BLOCK_DELETED": {
        if (event.type === "BLOCK_DELETED") {
          const { blockId } = event.payload;
          state.blocks.delete(blockId);
          state.blockOrder = state.blockOrder.filter((id) => id !== blockId);
          state.locks.delete(blockId);
          state.drafts.delete(blockId);
        }
        break;
      }

      case "BLOCK_LOCKED": {
        if (event.type === "BLOCK_LOCKED") {
          const { blockId, expiresAt } = event.payload;

          // Only allow lock if no existing lock or existing lock is expired
          const existingLock = state.locks.get(blockId);
          if (!existingLock || existingLock.expiresAt < event.timestamp) {
            state.locks.set(blockId, {
              blockId,
              userId: event.userId,
              acquiredAt: event.timestamp,
              expiresAt,
            });
          }
        }
        break;
      }

      case "BLOCK_UNLOCKED": {
        if (event.type === "BLOCK_UNLOCKED") {
          const { blockId } = event.payload;
          state.locks.delete(blockId);
        }
        break;
      }

      case "DRAFT_UPDATED": {
        if (event.type === "DRAFT_UPDATED") {
          const { blockId, content } = event.payload;
          state.drafts.set(blockId, {
            blockId,
            userId: event.userId,
            content,
            lastUpdated: event.timestamp,
          });
        }
        break;
      }

      case "DRAFT_COMMITTED": {
        if (event.type === "DRAFT_COMMITTED") {
          const { blockId } = event.payload;
          state.drafts.delete(blockId);
        }
        break;
      }

      case "USER_JOINED": {
        if (event.type === "USER_JOINED") {
          const { name, color } = event.payload;
          state.users.set(event.userId, {
            id: event.userId,
            name,
            color,
            isActive: true,
            lastSeen: event.timestamp,
          });
        }
        break;
      }

      case "USER_LEFT": {
        const user = state.users.get(event.userId);
        if (user) {
          state.users.set(event.userId, {
            ...user,
            isActive: false,
            lastSeen: event.timestamp,
          });
        }
        break;
      }
    }
  }

  return state;
}

export const useEventCoreStore = create<EventCoreStore>()(
  subscribeWithSelector((set, get) => ({
    events: [],
    currentVersion: 0,
    currentUserId: generateId(),
    currentState: {
      document: {
        id: "doc-1",
        title: "Collaborative Document",
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
      blocks: new Map(),
      blockOrder: [],
      users: new Map(),
      locks: new Map(),
      drafts: new Map(),
      version: 0,
    },

    dispatch: (eventData: {
      type: DocumentEvent["type"];
      payload: DocumentEvent["payload"];
    }) => {
      const { events, currentVersion, currentUserId } = get();
      const newVersion = currentVersion + 1;

      const event: DocumentEvent = {
        id: generateId(),
        type: eventData.type,
        payload: eventData.payload,
        userId: currentUserId,
        timestamp: Date.now(),
        documentId: "doc-1",
        version: newVersion,
      } as DocumentEvent;

      const newEvents = [...events, event];
      const newState = reduceEvents(newEvents);

      set({
        events: newEvents,
        currentVersion: newVersion,
        currentState: newState,
      });
    },

    syncExternalEvent: (event: DocumentEvent) => {
      const { events } = get();

      // Check if event already exists (prevent duplicates)
      const existingEvent = events.find((e) => e.id === event.id);
      if (existingEvent) return;

      // Insert event in correct order by version
      const newEvents = [...events, event].sort(
        (a, b) => a.version - b.version
      );
      const newState = reduceEvents(newEvents);

      // Update version to highest event version
      const maxVersion = Math.max(...newEvents.map((e) => e.version));

      set({
        events: newEvents,
        currentVersion: maxVersion,
        currentState: newState,
      });
    },

    replayEvents: () => {
      const { events } = get();
      const newState = reduceEvents(events);
      set({ currentState: newState });
    },

    setCurrentUser: (userId: string) => {
      set({ currentUserId: userId });
    },

    getState: () => get().currentState,
    getEvents: () => get().events,
  }))
);
