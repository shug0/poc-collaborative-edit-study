import type {
  DocumentEvent,
  DocumentCreatedPayload,
  BlockCreatedPayload,
  BlockContentChangedPayload,
  BlockDeletedPayload,
  BlockLockedPayload,
  BlockUnlockedPayload,
  DraftUpdatedPayload,
  DraftCommittedPayload,
  UserJoinedPayload,
  UserLeftPayload,
} from "./collaboration.types";

export type {
  DocumentEvent,
  DocumentCreatedPayload,
  BlockCreatedPayload,
  BlockContentChangedPayload,
  BlockDeletedPayload,
  BlockLockedPayload,
  BlockUnlockedPayload,
  DraftUpdatedPayload,
  DraftCommittedPayload,
  UserJoinedPayload,
  UserLeftPayload,
};

// Utility function to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Utility function to generate user colors
export function generateUserColor(): string {
  const colors = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Base event creator with proper typing
function createBaseEvent(userId: string, documentId: string, version: number) {
  return {
    id: generateId(),
    userId,
    timestamp: Date.now(),
    documentId,
    version,
  };
}

// Typed event creators
export function createDocumentCreatedEvent(
  payload: DocumentCreatedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "DOCUMENT_CREATED",
    payload,
  };
}

export function createBlockCreatedEvent(
  payload: BlockCreatedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "BLOCK_CREATED",
    payload,
  };
}

export function createBlockContentChangedEvent(
  payload: BlockContentChangedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "BLOCK_CONTENT_CHANGED",
    payload,
  };
}

export function createBlockDeletedEvent(
  payload: BlockDeletedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "BLOCK_DELETED",
    payload,
  };
}

export function createBlockLockedEvent(
  payload: BlockLockedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "BLOCK_LOCKED",
    payload,
  };
}

export function createBlockUnlockedEvent(
  payload: BlockUnlockedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "BLOCK_UNLOCKED",
    payload,
  };
}

export function createDraftUpdatedEvent(
  payload: DraftUpdatedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "DRAFT_UPDATED",
    payload,
  };
}

export function createDraftCommittedEvent(
  payload: DraftCommittedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "DRAFT_COMMITTED",
    payload,
  };
}

export function createUserJoinedEvent(
  payload: UserJoinedPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "USER_JOINED",
    payload,
  };
}

export function createUserLeftEvent(
  payload: UserLeftPayload,
  userId: string,
  documentId: string,
  version: number
): DocumentEvent {
  return {
    ...createBaseEvent(userId, documentId, version),
    type: "USER_LEFT",
    payload,
  };
}
