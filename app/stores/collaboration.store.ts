import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { User, BlockLock, Draft } from "../collaboration.types";
import { generateUserColor } from "../event.types";
import { useEventCoreStore } from "./event-core.store";

/**
 * Collaboration Store
 * Handles: Users, locks, drafts, real-time collaboration features
 */
interface CollaborationStore {
  // User management
  addUser: (name: string, userId?: string) => void;
  removeUser: (userId: string) => void;
  getActiveUsers: () => User[];
  getCurrentUser: () => User | undefined;

  // Lock operations
  lockBlock: (blockId: string) => void;
  unlockBlock: (blockId: string) => void;
  getBlockLock: (blockId: string) => BlockLock | undefined;
  isBlockLocked: (blockId: string) => boolean;
  canUserEditBlock: (blockId: string, userId?: string) => boolean;

  // Draft operations
  updateDraft: (blockId: string, content: string) => void;
  commitDraft: (blockId: string) => void;
  clearDraft: (blockId: string) => void;
  getDraft: (blockId: string) => Draft | undefined;
  getUserDrafts: (userId?: string) => Draft[];
}

export const useCollaborationStore = create<CollaborationStore>()(
  subscribeWithSelector((_set, get) => ({
    // User management
    addUser: (name: string, userId?: string) => {
      const eventCore = useEventCoreStore.getState();
      const originalUserId = eventCore.currentUserId;

      // Temporarily set user ID if provided
      if (userId) {
        useEventCoreStore.getState().setCurrentUser(userId);
      }

      eventCore.dispatch({
        type: "USER_JOINED",
        payload: {
          name,
          color: generateUserColor(),
        },
      });

      // Restore original user ID
      if (userId) {
        useEventCoreStore.getState().setCurrentUser(originalUserId);
      }
    },

    removeUser: (userId: string) => {
      const eventCore = useEventCoreStore.getState();
      const originalUserId = eventCore.currentUserId;

      // Temporarily set user ID to generate correct event
      useEventCoreStore.getState().setCurrentUser(userId);

      eventCore.dispatch({
        type: "USER_LEFT",
        payload: {},
      });

      // Restore original user ID
      useEventCoreStore.getState().setCurrentUser(originalUserId);
    },

    getActiveUsers: () => {
      const eventCore = useEventCoreStore.getState();
      return Array.from(eventCore.currentState.users.values()).filter(
        (user) => user.isActive
      );
    },

    getCurrentUser: () => {
      const eventCore = useEventCoreStore.getState();
      return eventCore.currentState.users.get(eventCore.currentUserId);
    },

    // Lock operations
    lockBlock: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();

      // Check if block is already locked and not expired
      const existingLock = get().getBlockLock(blockId); // This cleans up expired locks
      if (existingLock) {
        // Block is still locked by someone else
        return;
      }

      const expiresAt = Date.now() + 30000; // 30 seconds

      eventCore.dispatch({
        type: "BLOCK_LOCKED",
        payload: {
          blockId,
          expiresAt,
        },
      });
    },

    unlockBlock: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      eventCore.dispatch({
        type: "BLOCK_UNLOCKED",
        payload: { blockId },
      });
    },

    getBlockLock: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      const lock = eventCore.currentState.locks.get(blockId);

      // Check if lock is expired
      if (lock && lock.expiresAt < Date.now()) {
        get().unlockBlock(blockId);
        return undefined;
      }

      return lock;
    },

    isBlockLocked: (blockId: string) => {
      return get().getBlockLock(blockId) !== undefined;
    },

    canUserEditBlock: (blockId: string, userId?: string) => {
      const eventCore = useEventCoreStore.getState();
      const currentUserId = userId || eventCore.currentUserId;
      const lock = get().getBlockLock(blockId);

      // Block is not locked or locked by the current user
      return !lock || lock.userId === currentUserId;
    },

    // Draft operations
    updateDraft: (blockId: string, content: string) => {
      const eventCore = useEventCoreStore.getState();
      eventCore.dispatch({
        type: "DRAFT_UPDATED",
        payload: {
          blockId,
          content,
        },
      });
    },

    commitDraft: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      const draft = eventCore.currentState.drafts.get(blockId);

      if (draft) {
        // Update block content with draft content
        eventCore.dispatch({
          type: "BLOCK_CONTENT_CHANGED",
          payload: {
            blockId,
            content: draft.content,
            previousContent:
              eventCore.currentState.blocks.get(blockId)?.content || "",
          },
        });

        // Clear the draft
        eventCore.dispatch({
          type: "DRAFT_COMMITTED",
          payload: { blockId },
        });
      }
    },

    clearDraft: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      eventCore.dispatch({
        type: "DRAFT_COMMITTED",
        payload: { blockId },
      });
    },

    getDraft: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      return eventCore.currentState.drafts.get(blockId);
    },

    getUserDrafts: (userId?: string) => {
      const eventCore = useEventCoreStore.getState();
      const currentUserId = userId || eventCore.currentUserId;

      return Array.from(eventCore.currentState.drafts.values()).filter(
        (draft) => draft.userId === currentUserId
      );
    },
  }))
);
