import { describe, it, expect, beforeEach } from "vitest";
import {
  setup,
  create,
  actions,
  expect as testExpect,
  stores,
  state,
  events,
} from "./test-helpers";

describe("👥 Multi-User Collaboration", () => {
  beforeEach(() => {
    setup.reset();
  });

  describe("🏗️ User Management", () => {
    it("should track multiple users", () => {
      create.users(["Alice", "Bob"]);

      const users = state.users.getActive();
      expect(users).toHaveLength(2);
      expect(users.map((u) => u.name)).toContain("Alice");
      expect(users.map((u) => u.name)).toContain("Bob");
    });

    it("should handle user joining and leaving", () => {
      const [, bobId] = create.users(["Alice", "Bob"]);

      // Both users are active initially
      testExpect.counts({ users: 2 });
      expect(state.users.getActive()).toHaveLength(2);

      // Bob leaves
      stores.collaboration().removeUser(bobId);

      // Only Alice should be active
      expect(state.users.getActive()).toHaveLength(1);
      expect(state.users.getActive()[0].name).toBe("Alice");

      // Total users still 2 (including inactive)
      testExpect.counts({ users: 2 });
    });

    it("should generate unique user IDs and colors", () => {
      const userIds = create.users(["User1", "User2", "User3"]);

      // All user IDs should be unique
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(3);

      // All users should have colors assigned
      const users = state.users.getAll();
      users.forEach((user) => {
        expect(user.color).toBeDefined();
        expect(user.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe("🔄 Concurrent Operations", () => {
    it("should handle concurrent block creation", () => {
      const [aliceId, bobId] = create.users(["Alice", "Bob"]);

      // Alice creates blocks
      setup.setUser(aliceId);
      stores.document().createBlock("Alice block 1");
      stores.document().createBlock("Alice block 2");

      // Bob creates blocks concurrently
      setup.setUser(bobId);
      stores.document().createBlock("Bob block 1");
      stores.document().createBlock("Bob block 2");

      // Should have 4 blocks total
      testExpect.counts({ blocks: 4 });

      // Events should be from different users
      const blockEvents = events.getByType("BLOCK_CREATED");
      expect(blockEvents).toHaveLength(4);
      expect(blockEvents[0].userId).toBe(aliceId);
      expect(blockEvents[1].userId).toBe(aliceId);
      expect(blockEvents[2].userId).toBe(bobId);
      expect(blockEvents[3].userId).toBe(bobId);
    });

    it("should handle concurrent editing of different blocks", () => {
      // Setup: Create document with multiple blocks
      const [block1Id, block2Id] = create.blocks(2);
      const [aliceId, bobId] = create.users(["Alice", "Bob"]);

      // Alice edits block 1
      setup.setUser(aliceId);
      actions.editBlock(block1Id, "Alice's content", false); // Don't commit yet

      // Bob edits block 2 simultaneously
      setup.setUser(bobId);
      actions.editBlock(block2Id, "Bob's content", false); // Don't commit yet

      // Both should have active locks and drafts
      testExpect.counts({ locks: 2, drafts: 2 });

      // Verify each user owns their respective lock
      expect(state.locks.getByBlock(block1Id)?.userId).toBe(aliceId);
      expect(state.locks.getByBlock(block2Id)?.userId).toBe(bobId);

      // Verify each user has their draft
      expect(state.drafts.getByBlock(block1Id)?.userId).toBe(aliceId);
      expect(state.drafts.getByBlock(block2Id)?.userId).toBe(bobId);

      // Both users commit their changes
      setup.setUser(aliceId);
      stores.collaboration().commitDraft(block1Id);
      stores.collaboration().unlockBlock(block1Id);

      setup.setUser(bobId);
      stores.collaboration().commitDraft(block2Id);
      stores.collaboration().unlockBlock(block2Id);

      // Final state should show both edits
      testExpect.blockOrder(["Alice's content", "Bob's content"]);
      testExpect.counts({ locks: 0, drafts: 0 });
    });

    it("should handle rapid operations from multiple users", () => {
      const userIds = create.users(["User1", "User2", "User3"]);

      // Each user performs rapid operations
      userIds.forEach((userId, index) => {
        setup.setUser(userId);

        // Create multiple blocks rapidly
        for (let i = 0; i < 5; i++) {
          stores.document().createBlock(`User${index + 1} Block ${i + 1}`);
        }

        // Edit some blocks
        const userBlocks = state.blocks.getOrder().slice(-5, -2);
        userBlocks.forEach((blockId) => {
          actions.editBlock(blockId, `Edited by User${index + 1}`);
        });
      });

      // Verify all operations completed successfully
      testExpect.counts({
        users: 3,
        blocks: 15, // 3 users × 5 blocks each
      });

      // All events should be properly ordered
      const allEvents = events.getAll();
      allEvents.forEach((event, index) => {
        expect(event.version).toBe(index + 1);
      });
    });
  });

  describe("🔒 Collaborative Locking", () => {
    it("should prevent concurrent editing of the same block", () => {
      const [blockId] = create.blocks(1);
      const [aliceId, bobId] = create.users(["Alice", "Bob"]);

      // Alice locks the block first
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(blockId);

      // Bob tries to lock the same block
      setup.setUser(bobId);
      stores.collaboration().lockBlock(blockId);

      // Alice's lock should still be active (first wins)
      const lock = state.locks.getByBlock(blockId);
      expect(lock?.userId).toBe(aliceId);

      // Only one lock should exist
      testExpect.counts({ locks: 1 });
    });

    it("should allow lock transfer after release", () => {
      const [blockId] = create.blocks(1);
      const [aliceId, bobId] = create.users(["Alice", "Bob"]);

      // Alice acquires lock
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(blockId);
      expect(state.locks.getByBlock(blockId)?.userId).toBe(aliceId);

      // Alice releases lock
      stores.collaboration().unlockBlock(blockId);
      expect(state.locks.getByBlock(blockId)).toBeUndefined();

      // Bob can now acquire the lock
      setup.setUser(bobId);
      stores.collaboration().lockBlock(blockId);
      expect(state.locks.getByBlock(blockId)?.userId).toBe(bobId);
    });

    it("should handle lock timeouts in multi-user scenarios", () => {
      const [blockId] = create.blocks(1);
      const [aliceId, bobId] = create.users(["Alice", "Bob"]);

      // Alice locks the block
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(blockId);

      const lock = state.get().locks.get(blockId);
      expect(lock?.userId).toBe(aliceId);

      // Manually expire the lock
      if (lock) {
        lock.expiresAt = Date.now() - 1000; // 1 second ago
      }

      // Bob should now be able to acquire the lock
      setup.setUser(bobId);
      stores.collaboration().lockBlock(blockId);

      // Bob's lock should be active
      const newLock = state.locks.getByBlock(blockId);
      expect(newLock?.userId).toBe(bobId);
    });
  });

  describe("✏️ Real-Time Draft Sharing", () => {
    it("should show drafts from other users in real-time", () => {
      const [blockId] = create.blocks(1);
      const [aliceId, bobId] = create.users(["Alice", "Bob"]);

      // Alice starts editing
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(blockId);
      stores.collaboration().updateDraft(blockId, "Alice is typing...");

      // Bob should see Alice's draft
      setup.setUser(bobId);
      const draft = state.drafts.getByBlock(blockId);
      expect(draft?.content).toBe("Alice is typing...");
      expect(draft?.userId).toBe(aliceId);

      // Alice continues typing
      setup.setUser(aliceId);
      stores
        .collaboration()
        .updateDraft(blockId, "Alice is typing more content...");

      // Bob should see the updated draft immediately
      const updatedDraft = state.drafts.getByBlock(blockId);
      expect(updatedDraft?.content).toBe("Alice is typing more content...");
    });

    it("should handle multiple users with drafts on different blocks", () => {
      const [block1Id, block2Id, block3Id] = create.blocks(3);
      const [aliceId, bobId, charlieId] = create.users([
        "Alice",
        "Bob",
        "Charlie",
      ]);

      // Each user starts editing a different block
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(block1Id);
      stores.collaboration().updateDraft(block1Id, "Alice draft");

      setup.setUser(bobId);
      stores.collaboration().lockBlock(block2Id);
      stores.collaboration().updateDraft(block2Id, "Bob draft");

      setup.setUser(charlieId);
      stores.collaboration().lockBlock(block3Id);
      stores.collaboration().updateDraft(block3Id, "Charlie draft");

      // All drafts should be visible
      testExpect.counts({ drafts: 3, locks: 3 });

      // Each draft should be from the correct user
      expect(state.drafts.getByBlock(block1Id)?.userId).toBe(aliceId);
      expect(state.drafts.getByBlock(block2Id)?.userId).toBe(bobId);
      expect(state.drafts.getByBlock(block3Id)?.userId).toBe(charlieId);

      // Content should match
      expect(state.drafts.getByBlock(block1Id)?.content).toBe("Alice draft");
      expect(state.drafts.getByBlock(block2Id)?.content).toBe("Bob draft");
      expect(state.drafts.getByBlock(block3Id)?.content).toBe("Charlie draft");
    });

    it("should clear drafts after commit", () => {
      const [blockId] = create.blocks(1);
      const [aliceId] = create.users(["Alice", "Bob"]);

      // Alice creates a draft
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(blockId);
      stores.collaboration().updateDraft(blockId, "Alice's draft content");

      // Bob should see the draft
      expect(state.drafts.getByBlock(blockId)?.userId).toBe(aliceId);

      // Alice commits the draft
      stores.collaboration().commitDraft(blockId);
      stores.collaboration().unlockBlock(blockId);

      // Draft should be cleared for everyone
      expect(state.drafts.getByBlock(blockId)).toBeUndefined();

      // Content should be committed to the block
      const block = state.blocks.getById(blockId);
      expect(block?.content).toBe("Alice's draft content");
    });
  });

  describe("🌊 Complex Multi-User Workflows", () => {
    it("should handle complete collaborative editing session", () => {
      // Scenario: Three users collaborating on a document
      const [aliceId, bobId, charlieId] = create.users([
        "Alice",
        "Bob",
        "Charlie",
      ]);

      // Alice creates the document structure
      setup.setUser(aliceId);
      stores.document().createBlock("# Document Title");
      stores.document().createBlock("Introduction section");
      stores.document().createBlock("Main content");
      stores.document().createBlock("Conclusion");

      const [titleId, introId, contentId, conclusionId] =
        state.blocks.getOrder();

      // Alice edits the title
      actions.editBlock(titleId, "# Collaborative Document - Final Draft");

      // Bob edits introduction while Alice is working
      setup.setUser(bobId);
      stores.collaboration().lockBlock(introId);
      stores
        .collaboration()
        .updateDraft(
          introId,
          "Introduction: This document demonstrates real-time collaboration..."
        );

      // Charlie edits conclusion simultaneously
      setup.setUser(charlieId);
      stores.collaboration().lockBlock(conclusionId);
      stores
        .collaboration()
        .updateDraft(
          conclusionId,
          "Conclusion: Collaborative editing works seamlessly..."
        );

      // Alice finishes and moves to main content
      setup.setUser(aliceId);
      stores.collaboration().lockBlock(contentId);
      stores
        .collaboration()
        .updateDraft(
          contentId,
          "Main content: Here we discuss the key features..."
        );

      // Verify concurrent state
      testExpect.counts({
        blocks: 4,
        users: 3,
        locks: 3, // Bob, Charlie, Alice all have locks
        drafts: 3,
      });

      // Users commit their changes in order
      setup.setUser(bobId);
      stores.collaboration().commitDraft(introId);
      stores.collaboration().unlockBlock(introId);

      setup.setUser(charlieId);
      stores.collaboration().commitDraft(conclusionId);
      stores.collaboration().unlockBlock(conclusionId);

      setup.setUser(aliceId);
      stores.collaboration().commitDraft(contentId);
      stores.collaboration().unlockBlock(contentId);

      // Final verification
      testExpect.counts({ locks: 0, drafts: 0 });
      testExpect.blockOrder([
        "# Collaborative Document - Final Draft",
        "Introduction: This document demonstrates real-time collaboration...",
        "Main content: Here we discuss the key features...",
        "Conclusion: Collaborative editing works seamlessly...",
      ]);

      // All edits should be attributed correctly
      const blocks = state.blocks.getAll();
      expect(blocks[0].lastEditedBy).toBe(aliceId);
      expect(blocks[1].lastEditedBy).toBe(bobId);
      expect(blocks[2].lastEditedBy).toBe(aliceId);
      expect(blocks[3].lastEditedBy).toBe(charlieId);
    });

    it("should maintain consistency under high concurrent load", () => {
      // Stress test with many users and operations
      const userCount = 10;
      const blocksPerUser = 5;
      const editsPerUser = 3;

      const userIds = create.users(
        Array.from({ length: userCount }, (_, i) => `User${i + 1}`)
      );

      // Each user creates blocks and edits them
      userIds.forEach((userId, userIndex) => {
        setup.setUser(userId);

        // Create blocks
        const userBlocks = create.blocks(blocksPerUser, `User${userIndex + 1}`);

        // Edit some blocks
        for (let i = 0; i < editsPerUser; i++) {
          const blockId = userBlocks[i];
          actions.editBlock(blockId, `User${userIndex + 1} edit ${i + 1}`);
        }
      });

      // Verify final state
      testExpect.counts({
        users: userCount,
        blocks: userCount * blocksPerUser,
      });

      // All events should be properly ordered
      const allEvents = events.getAll();
      expect(allEvents.length).toBeGreaterThan(
        userCount * (blocksPerUser + editsPerUser * 3)
      );

      allEvents.forEach((event, index) => {
        expect(event.version).toBe(index + 1);
      });

      // No locks or drafts should remain
      testExpect.counts({ locks: 0, drafts: 0 });
    });
  });
});
