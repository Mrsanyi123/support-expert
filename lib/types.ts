export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type SourceRef = {
  ref: string;
  chunkId: string;
  documentId: string;
  title: string;
  heading: string | null;
  snippet: string;
};

export type ExampleRef = {
  ref: string;
  reviewId: string;
  caseId: string;
  ticketId: string;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  title: string;
  heading: string | null;
  text: string;
  rank: number;
};

export type RetrievedExample = {
  reviewId: string;
  caseId: string;
  ticketId: string;
  productArea: string;
  question: string;
  answer: string;
  rank: number;
};
