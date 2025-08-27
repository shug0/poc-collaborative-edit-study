import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Block } from "../collaboration.types";
import { generateId } from "../event.types";
import { useEventCoreStore } from "./event-core.store";

/**
 * Document & Block Operations Store
 * Handles: Block CRUD, document management, content operations
 */
interface DocumentStore {
  // Block operations
  createBlock: (content: string, position?: number) => void;
  updateBlockContent: (blockId: string, content: string) => void;
  deleteBlock: (blockId: string) => void;

  // Block queries
  getBlockById: (blockId: string) => Block | undefined;
  getAllBlocks: () => Block[];
  getBlockOrder: () => string[];

  // Document operations
  initializeDocument: () => void;
  setDocumentTitle: (title: string) => void;
}

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((_, get) => ({
    // Block operations
    createBlock: (content: string, position?: number) => {
      const eventCore = useEventCoreStore.getState();
      const blockId = generateId();
      const actualPosition =
        position ?? eventCore.currentState.blockOrder.length;

      eventCore.dispatch({
        type: "BLOCK_CREATED",
        payload: {
          blockId,
          content,
          position: actualPosition,
        },
      });
    },

    updateBlockContent: (blockId: string, content: string) => {
      const eventCore = useEventCoreStore.getState();
      const block = eventCore.currentState.blocks.get(blockId);
      if (!block) return;

      eventCore.dispatch({
        type: "BLOCK_CONTENT_CHANGED",
        payload: {
          blockId,
          content,
          previousContent: block.content,
        },
      });
    },

    deleteBlock: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      eventCore.dispatch({
        type: "BLOCK_DELETED",
        payload: { blockId },
      });
    },

    // Block queries
    getBlockById: (blockId: string) => {
      const eventCore = useEventCoreStore.getState();
      return eventCore.currentState.blocks.get(blockId);
    },

    getAllBlocks: () => {
      const eventCore = useEventCoreStore.getState();
      return Array.from(eventCore.currentState.blocks.values());
    },

    getBlockOrder: () => {
      const eventCore = useEventCoreStore.getState();
      return [...eventCore.currentState.blockOrder];
    },

    // Document operations
    initializeDocument: () => {
      const documentStore = get();
      documentStore.createBlock("Start typing here...", 0);
    },

    setDocumentTitle: (title: string) => {
      const eventCore = useEventCoreStore.getState();
      eventCore.dispatch({
        type: "DOCUMENT_CREATED",
        payload: {
          title,
          createdAt: Date.now(),
        },
      });
    },
  }))
);
