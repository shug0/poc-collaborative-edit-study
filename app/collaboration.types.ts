// Event Payload Types
export type DocumentEventType =
  | "DOCUMENT_CREATED"
  | "BLOCK_CREATED"
  | "BLOCK_CONTENT_CHANGED"
  | "BLOCK_DELETED"
  | "BLOCK_MOVED"
  | "BLOCK_LOCKED"
  | "BLOCK_UNLOCKED"
  | "DRAFT_UPDATED"
  | "DRAFT_COMMITTED"
  | "USER_JOINED"
  | "USER_LEFT"
  | "USER_ACTIVITY";

// Base Event Structure
interface BaseDocumentEvent {
  id: string;
  userId: string;
  timestamp: number;
  documentId: string;
  version: number;
}

// Discriminated Union for Typed Events
export type DocumentEvent =
  | (BaseDocumentEvent & {
      type: "DOCUMENT_CREATED";
      payload: DocumentCreatedPayload;
    })
  | (BaseDocumentEvent & {
      type: "BLOCK_CREATED";
      payload: BlockCreatedPayload;
    })
  | (BaseDocumentEvent & {
      type: "BLOCK_CONTENT_CHANGED";
      payload: BlockContentChangedPayload;
    })
  | (BaseDocumentEvent & {
      type: "BLOCK_DELETED";
      payload: BlockDeletedPayload;
    })
  | (BaseDocumentEvent & { type: "BLOCK_MOVED"; payload: BlockMovedPayload })
  | (BaseDocumentEvent & { type: "BLOCK_LOCKED"; payload: BlockLockedPayload })
  | (BaseDocumentEvent & {
      type: "BLOCK_UNLOCKED";
      payload: BlockUnlockedPayload;
    })
  | (BaseDocumentEvent & {
      type: "DRAFT_UPDATED";
      payload: DraftUpdatedPayload;
    })
  | (BaseDocumentEvent & {
      type: "DRAFT_COMMITTED";
      payload: DraftCommittedPayload;
    })
  | (BaseDocumentEvent & { type: "USER_JOINED"; payload: UserJoinedPayload })
  | (BaseDocumentEvent & { type: "USER_LEFT"; payload: UserLeftPayload })
  | (BaseDocumentEvent & {
      type: "USER_ACTIVITY";
      payload: UserActivityPayload;
    });

// Event Payloads
export interface DocumentCreatedPayload {
  title: string;
  createdAt: number;
}

export interface BlockCreatedPayload {
  blockId: string;
  content: string;
  position: number;
}

export interface BlockContentChangedPayload {
  blockId: string;
  content: string;
  previousContent: string;
}

export interface BlockDeletedPayload {
  blockId: string;
}

export interface BlockMovedPayload {
  blockId: string;
  oldPosition: number;
  newPosition: number;
}

export interface BlockLockedPayload {
  blockId: string;
  expiresAt: number;
}

export interface BlockUnlockedPayload {
  blockId: string;
}

export interface DraftUpdatedPayload {
  blockId: string;
  content: string;
}

export interface DraftCommittedPayload {
  blockId: string;
}

export interface UserJoinedPayload {
  name: string;
  color: string;
}

export interface UserLeftPayload {
  userId: string;
}

export interface UserActivityPayload {
  activityType: "cursor_moved" | "typing" | "idle";
  timestamp: number;
}

// Derived State Models
export interface DocumentState {
  document: Document;
  blocks: Map<string, Block>;
  blockOrder: string[];
  users: Map<string, User>;
  locks: Map<string, BlockLock>;
  drafts: Map<string, Draft>;
  version: number;
}

export interface Document {
  id: string;
  title: string;
  createdAt: number;
  lastModified: number;
}

export interface Block {
  id: string;
  content: string;
  position: number;
  createdAt: number;
  lastModified: number;
  lastEditedBy: string;
}

export interface User {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  lastSeen: number;
}

export interface BlockLock {
  blockId: string;
  userId: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface Draft {
  blockId: string;
  userId: string;
  content: string;
  lastUpdated: number;
}
