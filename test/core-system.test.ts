import { describe, it, expect, beforeEach } from "vitest";
import {
  getStore,
  resetStore,
  createTestBlocks,
  getEventsByType,
  expectBlockOrder,
  expectStoreState,
  createAndLockBlock,
  createEditAndCommitDraft,
  measureTime,
  events,
} from "./test-helpers";

describe("Core System Validation", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("🏗️ Event Sourcing Foundation", () => {
    it("should dispatch events and update state atomically", () => {
      const store = getStore();

      store.dispatch({
        type: "BLOCK_CREATED",
        payload: {
          blockId: "test-block",
          content: "Test content",
          position: 0,
        },
      });

      expectStoreState({
        events: 1,
        blocks: 1,
      });
      expect(getStore().currentState.blockOrder).toHaveLength(1);
    });

    it("should maintain event ordering and versioning", () => {
      createTestBlocks(3);

      expectStoreState({
        events: 3,
        version: 3,
      });

      // Events should be properly versioned
      getStore().events.forEach((event, index) => {
        expect(event.version).toBe(index + 1);
      });
    });
  });

  describe("📝 Block Management", () => {
    it("should create and manage blocks", () => {
      createTestBlocks(2);

      expectStoreState({
        blocks: 2,
      });
      expect(getStore().currentState.blockOrder).toHaveLength(2);

      expectBlockOrder(["Block 1", "Block 2"]);
    });

    it("should update block content and track changes", () => {
      getStore().createBlock("Original content");

      const blockId = getStore().currentState.blockOrder[0];
      getStore().updateBlockContent(blockId, "Updated content");

      const block = getStore().currentState.blocks.get(blockId);
      expect(block?.content).toBe("Updated content");

      // Should have CREATE + UPDATE events
      expectStoreState({ events: 2 });
      expect(getEventsByType("BLOCK_CONTENT_CHANGED")).toHaveLength(1);
    });

    it("should maintain block order when inserting", () => {
      getStore().createBlock("Block 1");
      getStore().createBlock("Block 2");
      getStore().createBlock("Block 3", 1); // Insert at position 1

      expectStoreState({ blocks: 3 });
      expectBlockOrder(["Block 1", "Block 3", "Block 2"]);
    });
  });

  describe("🔒 Locking System", () => {
    it("should acquire and release locks", () => {
      getStore().createBlock("Test block");
      const blockId = getStore().currentState.blockOrder[0];

      getStore().lockBlock(blockId);

      const store1 = getStore();
      const lock = store1.getBlockLock(blockId);
      expect(lock).toBeDefined();
      expect(lock?.blockId).toBe(blockId);
      expect(lock?.userId).toBe(store1.currentUserId);

      getStore().unlockBlock(blockId);

      const store2 = getStore();
      expect(store2.getBlockLock(blockId)).toBeUndefined();
    });

    it("should handle lock conflicts (first lock wins)", () => {
      const blockId = createAndLockBlock("Test block", "user1");

      // User 2 tries to lock the same block
      getStore().setCurrentUser("user2");
      getStore().lockBlock(blockId);

      // First lock should still be active
      const lock = getStore().getBlockLock(blockId);
      expect(lock?.userId).toBe("user1");
    });
  });

  describe("✏️ Draft System", () => {
    it("should track real-time drafts", () => {
      getStore().createBlock("Original content");
      const blockId = getStore().currentState.blockOrder[0];

      getStore().updateDraft(blockId, "Draft content in progress");

      const store = getStore();
      const draft = store.getDraft(blockId);
      expect(draft).toBeDefined();
      expect(draft?.content).toBe("Draft content in progress");
      expect(draft?.userId).toBe(store.currentUserId);
    });

    it("should commit drafts to final content", () => {
      const blockId = createEditAndCommitDraft(
        "Original content",
        "Final content from draft"
      );

      // Draft should be cleared
      expect(getStore().getDraft(blockId)).toBeUndefined();

      // Content should be updated
      const block = getStore().currentState.blocks.get(blockId);
      expect(block?.content).toBe("Final content from draft");

      // Should have proper events
      const eventCounts = events.getCountsByTypes([
        "DRAFT_UPDATED",
        "DRAFT_COMMITTED",
        "BLOCK_CONTENT_CHANGED",
      ]);
      expect(eventCounts.DRAFT_UPDATED).toBe(1);
      expect(eventCounts.DRAFT_COMMITTED).toBe(1);
      expect(eventCounts.BLOCK_CONTENT_CHANGED).toBe(1);
    });
  });

  describe("⚡ Performance & Edge Cases", () => {
    it("should handle rapid operations efficiently", () => {
      const numBlocks = 50;

      const { duration } = measureTime(() => {
        for (let i = 0; i < numBlocks; i++) {
          getStore().createBlock(`Block ${i}`);
        }
      });

      expectStoreState({
        blocks: numBlocks,
        events: numBlocks,
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(100); // 100ms threshold
    });

    it("should maintain consistency with complex workflows", () => {
      // Create document structure
      const [block1Id, block2Id] = createTestBlocks(2);

      // User interactions
      getStore().lockBlock(block1Id);
      getStore().updateDraft(block1Id, "User editing section 1");
      getStore().lockBlock(block2Id);
      getStore().updateDraft(block2Id, "User editing section 2");

      expectStoreState({
        locks: 2,
        drafts: 2,
      });

      // Commit one section
      getStore().commitDraft(block1Id);
      getStore().unlockBlock(block1Id);

      expectStoreState({
        locks: 1,
        drafts: 1,
      });

      expect(getStore().currentState.blocks.get(block1Id)?.content).toBe(
        "User editing section 1"
      );
    });
  });

  describe("🔄 Event Sourcing Integrity", () => {
    it("should replay events to reconstruct identical state", () => {
      // Perform various operations
      getStore().addUser("Test User");
      getStore().createBlock("Block 1");
      getStore().createBlock("Block 2");

      const store1 = getStore();
      const blockId = store1.currentState.blockOrder[0];

      getStore().lockBlock(blockId);
      getStore().updateDraft(blockId, "Draft content");

      // Save current state
      const store2 = getStore();
      const originalVersion = store2.currentVersion;
      const originalBlocksSize = store2.currentState.blocks.size;
      const originalUsersSize = store2.currentState.users.size;

      // Replay events
      getStore().replayEvents();

      // State should be identical
      const store3 = getStore();
      expect(store3.currentVersion).toBe(originalVersion);
      expect(store3.currentState.blocks.size).toBe(originalBlocksSize);
      expect(store3.currentState.users.size).toBe(originalUsersSize);
      expect(store3.currentState.locks.size).toBe(1);
      expect(store3.currentState.drafts.size).toBe(1);
    });
  });
});
