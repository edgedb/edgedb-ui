import {Stream} from "@anthropic-ai/sdk/streaming";
import {ConnectConfig} from "../../../state/connection";

export type ChatParticipantRole = "system" | "user" | "assistant" | "tool";

export interface RAGRequest {
  context: RAGRequestContext;
  model: string;
  query: string;
  prompt?: ({name: string} | {id: string} | never) & {
    custom?: {
      role: ChatParticipantRole;
      content: string;
    }[];
  };
}

export interface RAGRequestContext {
  query: string;
  variables?: Record<string, any>;
  globals?: Record<string, any>;
  max_object_count?: number;
}

export type SSEEvent =
  | {
      type: "message_start";
      message: {id: string; model: string; role: ChatParticipantRole};
    }
  | {
      type: "content_block_start";
      index: number;
      content_block: {type: "text"; text: string};
    }
  | {
      type: "content_block_delta";
      index: number;
      delta: {type: "text_delta"; text: string};
    }
  | {
      type: "content_block_stop";
      index: number;
    }
  | {
      type: "message_delta";
      delta: {stop_reason: string};
    }
  | {
      type: "message_stop";
    }
  | {
      type: "ping";
    }
  | {
      type: "error";
      error: {type: string; message: string};
    };

export type SSEStream = Stream<SSEEvent>;

export async function runRAGQuery(
  connectConfig: ConnectConfig,
  request: RAGRequest,
  abortController: AbortController
): Promise<SSEStream> {
  const response = await fetch(
    `${connectConfig.serverUrl}/branch/${connectConfig.database}/ext/ai/rag`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${connectConfig.authToken}`,
        "X-EdgeDB-User": connectConfig.user,
      },
      body: JSON.stringify({...request, stream: true}),
      signal: abortController.signal,
    }
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText);
  }
  return Stream.fromSSEResponse(response, abortController);
}
