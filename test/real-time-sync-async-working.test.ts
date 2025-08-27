import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useEventCoreStore,
  useDocumentStore,
  useCollaborationStore,
} from "../app/stores";
import { setup } from "./test-helpers";

/**
 * Working Async Real-Time Sync Testing
 * Properly handles fake timers for async operations
 */

// Helper to create a user tab with async operations
const createAsyncUserTab = (userId: string, userName: string) => {
  useEventCoreStore.getState().setCurrentUser(userId);
  useCollaborationStore.getState().addUser(userName, userId);

  return {
    userId,
    userName,

    createBlock: async (content: string) => {
      // Simulate network delay
      setTimeout(() => {
        useEventCoreStore.getState().setCurrentUser(userId);
        useDocumentStore.getState().createBlock(content);
      }, 10);

      // Advance timers to execute the delayed operation
      await vi.advanceTimersByTimeAsync(10);
    },

    lockBlock: async (blockId: string) => {
      setTimeout(() => {
        useEventCoreStore.getState().setCurrentUser(userId);
        useCollaborationStore.getState().lockBlock(blockId);
      }, 10);

      await vi.advanceTimersByTimeAsync(10);
      return (
        useCollaborationStore.getState().getBlockLock(blockId)?.userId ===
        userId
      );
    },

    updateDraft: async (blockId: string, content: string) => {
      setTimeout(() => {
        useEventCoreStore.getState().setCurrentUser(userId);
        useCollaborationStore.getState().updateDraft(blockId, content);
      }, 10);

      await vi.advanceTimersByTimeAsync(10);
    },

    commitDraft: async (blockId: string) => {
      setTimeout(() => {
        useEventCoreStore.getState().setCurrentUser(userId);
        useCollaborationStore.getState().commitDraft(blockId);
        useCollaborationStore.getState().unlockBlock(blockId);
      }, 10);

      await vi.advanceTimersByTimeAsync(10);
    },

    getState: () => useEventCoreStore.getState().currentState,
  };
};

describe("🚀 Working Async Real-Time Sync", () => {
  beforeEach(() => {
    setup.reset();
  });

  describe("🌐 Async Operations with Fake Timers", () => {
    it("should handle async block creation with simulated network delay", async () => {
      const alice = createAsyncUserTab("alice", "Alice");
      const bob = createAsyncUserTab("bob", "Bob");

      // Alice creates a block with simulated delay
      await alice.createBlock("Alice's delayed block");

      // Bob should see the block after the delay
      expect(bob.getState().blocks.size).toBe(1);
      expect(bob.getState().blockOrder).toHaveLength(1);

      const blockId = bob.getState().blockOrder[0];
      const block = bob.getState().blocks.get(blockId);
      expect(block?.content).toBe("Alice's delayed block");
    });

    it("should handle concurrent async operations", async () => {
      const alice = createAsyncUserTab("alice", "Alice");
      const bob = createAsyncUserTab("bob", "Bob");
      const charlie = createAsyncUserTab("charlie", "Charlie");

      // All users create blocks with delays - execute concurrently
      const operations = [
        alice.createBlock("Alice block"),
        bob.createBlock("Bob block"),
        charlie.createBlock("Charlie block"),
      ];

      await Promise.all(operations);

      // All should see all blocks
      expect(alice.getState().blocks.size).toBe(3);
      expect(bob.getState().blocks.size).toBe(3);
      expect(charlie.getState().blocks.size).toBe(3);
    });
  });

  describe("🔐 Async Lock Competition", () => {
    it("should handle lock race conditions with timing", async () => {
      const alice = createAsyncUserTab("alice", "Alice");
      const bob = createAsyncUserTab("bob", "Bob");

      // Create a shared block first
      await alice.createBlock("Shared content");
      const blockId = alice.getState().blockOrder[0];

      // Both try to lock with slight timing differences
      const aliceLockPromise = alice.lockBlock(blockId);

      // Bob tries to lock slightly later
      setTimeout(async () => {
        await bob.lockBlock(blockId);
      }, 5);

      const aliceLockResult = await aliceLockPromise;

      // Advance time to let Bob's attempt complete
      await vi.advanceTimersByTimeAsync(15);

      // Only Alice should have the lock (first lock wins)
      expect(aliceLockResult).toBe(true);

      const currentLock = bob.getState().locks.get(blockId);
      expect(currentLock?.userId).toBe(alice.userId);
    });
  });

  describe("✏️ Async Draft Workflow", () => {
    it("should handle draft updates with realistic timing", async () => {
      const alice = createAsyncUserTab("alice", "Alice");
      const bob = createAsyncUserTab("bob", "Bob");

      // Alice creates and locks a block
      await alice.createBlock("Original");
      const blockId = alice.getState().blockOrder[0];

      const lockSuccess = await alice.lockBlock(blockId);
      expect(lockSuccess).toBe(true);

      // Alice types with realistic delays (simulating keystrokes)
      await alice.updateDraft(blockId, "A");
      await alice.updateDraft(blockId, "Al");
      await alice.updateDraft(blockId, "Alice is typing");

      // Bob should see the latest draft
      expect(bob.getState().drafts.get(blockId)?.content).toBe(
        "Alice is typing"
      );

      // Alice commits
      await alice.commitDraft(blockId);

      // Bob should see committed content
      expect(bob.getState().blocks.get(blockId)?.content).toBe(
        "Alice is typing"
      );
      expect(bob.getState().drafts.get(blockId)).toBeUndefined();
      expect(bob.getState().locks.get(blockId)).toBeUndefined();
    });
  });

  describe("⚡ Complex Async Scenarios", () => {
    it("should handle staggered collaborative editing", async () => {
      const alice = createAsyncUserTab("alice", "Alice");
      const bob = createAsyncUserTab("bob", "Bob");
      const charlie = createAsyncUserTab("charlie", "Charlie");

      // Alice creates document structure
      await alice.createBlock("# Document");
      await alice.createBlock("## Section 1");
      await alice.createBlock("## Section 2");

      const blockIds = alice.getState().blockOrder;

      // Staggered editing with different timing
      const editingWorkflow = [
        // Alice starts immediately
        (async () => {
          const locked = await alice.lockBlock(blockIds[0]);
          if (locked) {
            await alice.updateDraft(blockIds[0], "# Final Report");
            await alice.commitDraft(blockIds[0]);
          }
        })(),

        // Bob starts after a short delay
        (async () => {
          await vi.advanceTimersByTimeAsync(20);
          const locked = await bob.lockBlock(blockIds[1]);
          if (locked) {
            await bob.updateDraft(
              blockIds[1],
              "## Introduction\nContent here..."
            );
            await bob.commitDraft(blockIds[1]);
          }
        })(),

        // Charlie starts even later
        (async () => {
          await vi.advanceTimersByTimeAsync(40);
          const locked = await charlie.lockBlock(blockIds[2]);
          if (locked) {
            await charlie.updateDraft(
              blockIds[2],
              "## Conclusion\nFinal thoughts..."
            );
            await charlie.commitDraft(blockIds[2]);
          }
        })(),
      ];

      // Execute staggered workflow
      await Promise.all(editingWorkflow);

      // Verify final state
      const finalState = alice.getState();
      expect(finalState.locks.size).toBe(0);
      expect(finalState.drafts.size).toBe(0);

      // Check content was updated
      const blocks = Array.from(finalState.blocks.values());
      expect(blocks.some((b) => b.content.includes("Final Report"))).toBe(true);
      expect(blocks.some((b) => b.content.includes("Introduction"))).toBe(true);
      expect(blocks.some((b) => b.content.includes("Conclusion"))).toBe(true);
    });

    it("should demonstrate event ordering with async operations", async () => {
      const alice = createAsyncUserTab("alice", "Alice");
      const bob = createAsyncUserTab("bob", "Bob");

      // Create blocks sequentially with timing
      await alice.createBlock("Block 1");
      await bob.createBlock("Block 2");
      await alice.createBlock("Block 3");

      // Verify events are properly ordered by version
      const events = useEventCoreStore.getState().events;
      const blockEvents = events.filter((e) => e.type === "BLOCK_CREATED");

      expect(blockEvents).toHaveLength(3);

      // Events should be ordered by version
      for (let i = 1; i < blockEvents.length; i++) {
        expect(blockEvents[i].version).toBeGreaterThan(
          blockEvents[i - 1].version
        );
      }

      // All blocks should be visible to all users
      expect(alice.getState().blocks.size).toBe(3);
      expect(bob.getState().blocks.size).toBe(3);
    });
  });
});
