import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createCollaborativeSession,
  simulateUserAction,
  type MockCollaborativeSession,
} from "./real-time-sync-utilities";

describe("🚀 Real-Time Sync POC", () => {
  let session: MockCollaborativeSession;

  beforeEach(() => {
    session = createCollaborativeSession();
  });

  afterEach(() => {
    session.cleanup();
  });

  describe("📱 Multi-Tab Block Operations", () => {
    it("should sync block creation across tabs instantly", () => {
      // Setup: Two users in different tabs
      const aliceTab = session.createTab("tab1", "Alice");
      const bobTab = session.createTab("tab2", "Bob");

      // Alice creates a block in her tab
      simulateUserAction(aliceTab, () => {
        aliceTab.document.createBlock("Alice's block content");
      });

      // Bob should see Alice's block immediately in his tab
      session.switchToTab("tab2");
      const bobState = bobTab.getCurrentState();

      expect(bobState.blocks.size).toBe(1);
      expect(bobState.blockOrder).toHaveLength(1);

      const blockId = bobState.blockOrder[0];
      const block = bobState.blocks.get(blockId);
      expect(block?.content).toBe("Alice's block content");
      expect(block?.lastEditedBy).toBe(aliceTab.userId);

      // Verify both tabs have consistent state
      expect(session.verifyConsistency()).toBe(true);
    });

    it("should handle concurrent block creation from multiple tabs", () => {
      // Setup: Three users in different tabs
      const aliceTab = session.createTab("tab1", "Alice");
      const bobTab = session.createTab("tab2", "Bob");
      const charlieTab = session.createTab("tab3", "Charlie");

      // All users create blocks
      simulateUserAction(aliceTab, () => {
        aliceTab.document.createBlock("Alice's block");
      });

      simulateUserAction(bobTab, () => {
        bobTab.document.createBlock("Bob's block");
      });

      simulateUserAction(charlieTab, () => {
        charlieTab.document.createBlock("Charlie's block");
      });

      // All tabs should see all 3 blocks
      const aliceState = aliceTab.getCurrentState();
      const bobState = bobTab.getCurrentState();
      const charlieState = charlieTab.getCurrentState();

      expect(aliceState.blocks.size).toBe(3);
      expect(bobState.blocks.size).toBe(3);
      expect(charlieState.blocks.size).toBe(3);

      // Verify event ordering is consistent
      const aliceEvents = aliceTab.getEvents();
      const bobEvents = bobTab.getEvents();

      expect(aliceEvents).toHaveLength(bobEvents.length);
      aliceEvents.forEach((event, index) => {
        expect(event.id).toBe(bobEvents[index].id);
        expect(event.version).toBe(bobEvents[index].version);
      });

      // Verify all tabs have identical state
      expect(session.verifyConsistency()).toBe(true);
    });
  });

  describe("🔄 Real-Time Draft Synchronization", () => {
    it("should stream draft updates across tabs in real-time", () => {
      // Setup: Two tabs with a shared block
      const aliceTab = session.createTab("tab1", "Alice");
      const bobTab = session.createTab("tab2", "Bob");

      // Create a shared block
      simulateUserAction(aliceTab, () => {
        aliceTab.document.createBlock("Original content");
      });

      const blockId = aliceTab.getCurrentState().blockOrder[0];

      // Alice starts editing (lock + draft)
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.lockBlock(blockId);
        aliceTab.collaboration.updateDraft(blockId, "Alice is typing...");
      });

      // Bob should see Alice's draft immediately
      session.switchToTab("tab2");
      const bobState = bobTab.getCurrentState();

      const draft = bobState.drafts.get(blockId);
      expect(draft).toBeDefined();
      expect(draft?.content).toBe("Alice is typing...");
      expect(draft?.userId).toBe(aliceTab.userId);

      // Alice continues typing
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.updateDraft(
          blockId,
          "Alice is typing more content..."
        );
      });

      // Bob sees the updated draft
      const updatedDraft = bobTab.getCurrentState().drafts.get(blockId);
      expect(updatedDraft?.content).toBe("Alice is typing more content...");

      // Verify consistency
      expect(session.verifyConsistency()).toBe(true);
    });

    it("should sync draft commits across all tabs", () => {
      // Setup: Multiple tabs
      const aliceTab = session.createTab("tab1", "Alice");
      const bobTab = session.createTab("tab2", "Bob");
      const charlieTab = session.createTab("tab3", "Charlie");

      // Create a block and start drafting
      simulateUserAction(aliceTab, () => {
        aliceTab.document.createBlock("Original");
      });

      const blockId = aliceTab.getCurrentState().blockOrder[0];

      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.lockBlock(blockId);
        aliceTab.collaboration.updateDraft(blockId, "Final content");
      });

      // All tabs should see the draft
      expect(bobTab.getCurrentState().drafts.get(blockId)?.content).toBe(
        "Final content"
      );
      expect(charlieTab.getCurrentState().drafts.get(blockId)?.content).toBe(
        "Final content"
      );

      // Alice commits the draft
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.commitDraft(blockId);
        aliceTab.collaboration.unlockBlock(blockId);
      });

      // All tabs should see the committed content and cleared draft
      [bobTab, charlieTab].forEach((tab) => {
        const state = tab.getCurrentState();
        expect(state.drafts.get(blockId)).toBeUndefined();
        expect(state.blocks.get(blockId)?.content).toBe("Final content");
        expect(state.locks.get(blockId)).toBeUndefined();
      });

      expect(session.verifyConsistency()).toBe(true);
    });
  });

  describe("🔒 Cross-Tab Lock Synchronization", () => {
    it("should prevent concurrent editing across tabs", () => {
      // Setup: Two tabs
      const aliceTab = session.createTab("tab1", "Alice");
      const bobTab = session.createTab("tab2", "Bob");

      // Create a shared block
      simulateUserAction(aliceTab, () => {
        aliceTab.document.createBlock("Shared content");
      });

      const blockId = aliceTab.getCurrentState().blockOrder[0];

      // Alice locks the block
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.lockBlock(blockId);
      });

      // Bob should see Alice's lock immediately
      session.switchToTab("tab2");
      const bobLock = bobTab.collaboration.getBlockLock(blockId);
      expect(bobLock?.userId).toBe(aliceTab.userId);

      // Bob tries to lock the same block (should fail)
      simulateUserAction(bobTab, () => {
        bobTab.collaboration.lockBlock(blockId);
      });

      // Alice should still own the lock
      const currentLock = bobTab.collaboration.getBlockLock(blockId);
      expect(currentLock?.userId).toBe(aliceTab.userId);

      // Alice releases the lock
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.unlockBlock(blockId);
      });

      // Bob should see the lock is released
      expect(bobTab.collaboration.getBlockLock(blockId)).toBeUndefined();

      // Now Bob can acquire the lock
      simulateUserAction(bobTab, () => {
        bobTab.collaboration.lockBlock(blockId);
      });

      const bobNewLock = bobTab.collaboration.getBlockLock(blockId);
      expect(bobNewLock?.userId).toBe(bobTab.userId);

      expect(session.verifyConsistency()).toBe(true);
    });
  });

  describe("⚡ Complex Multi-Tab Workflows", () => {
    it("should handle realistic collaborative editing session", () => {
      // Setup: Team collaboration scenario
      const aliceTab = session.createTab("alice-tab", "Alice");
      const bobTab = session.createTab("bob-tab", "Bob");
      const charlieTab = session.createTab("charlie-tab", "Charlie");

      // Alice creates document structure
      simulateUserAction(aliceTab, () => {
        aliceTab.document.createBlock("# Team Document");
        aliceTab.document.createBlock("## Introduction");
        aliceTab.document.createBlock("## Main Content");
        aliceTab.document.createBlock("## Conclusion");
      });

      const blockIds = aliceTab.getCurrentState().blockOrder;

      // Concurrent editing: Each person works on different sections
      // Alice edits title
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.lockBlock(blockIds[0]);
        aliceTab.collaboration.updateDraft(
          blockIds[0],
          "# Team Project Proposal"
        );
      });

      // Bob edits introduction
      simulateUserAction(bobTab, () => {
        bobTab.collaboration.lockBlock(blockIds[1]);
        bobTab.collaboration.updateDraft(
          blockIds[1],
          "## Introduction\nThis proposal outlines..."
        );
      });

      // Charlie edits conclusion
      simulateUserAction(charlieTab, () => {
        charlieTab.collaboration.lockBlock(blockIds[3]);
        charlieTab.collaboration.updateDraft(
          blockIds[3],
          "## Conclusion\nIn summary..."
        );
      });

      // Verify all tabs see all three drafts
      [aliceTab, bobTab, charlieTab].forEach((tab) => {
        const state = tab.getCurrentState();
        expect(state.drafts.size).toBe(3);
        expect(state.locks.size).toBe(3);
      });

      // Users commit their changes in sequence
      simulateUserAction(aliceTab, () => {
        aliceTab.collaboration.commitDraft(blockIds[0]);
        aliceTab.collaboration.unlockBlock(blockIds[0]);
      });

      simulateUserAction(bobTab, () => {
        bobTab.collaboration.commitDraft(blockIds[1]);
        bobTab.collaboration.unlockBlock(blockIds[1]);
      });

      simulateUserAction(charlieTab, () => {
        charlieTab.collaboration.commitDraft(blockIds[3]);
        charlieTab.collaboration.unlockBlock(blockIds[3]);
      });

      // Verify final state across all tabs
      [aliceTab, bobTab, charlieTab].forEach((tab) => {
        const state = tab.getCurrentState();
        expect(state.locks.size).toBe(0);
        expect(state.drafts.size).toBe(0);
        expect(state.blocks.get(blockIds[0])?.content).toBe(
          "# Team Project Proposal"
        );
        expect(state.blocks.get(blockIds[1])?.content).toBe(
          "## Introduction\nThis proposal outlines..."
        );
        expect(state.blocks.get(blockIds[3])?.content).toBe(
          "## Conclusion\nIn summary..."
        );
      });

      // Verify perfect consistency
      expect(session.verifyConsistency()).toBe(true);

      // Verify event log has all operations
      const events = aliceTab.getEvents();
      expect(events.length).toBeGreaterThan(10); // Initial blocks + locks + drafts + commits + unlocks
    });
  });
});
