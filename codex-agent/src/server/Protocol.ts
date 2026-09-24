import { z } from 'zod';

export const AuthMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(1, 'Token is required'),
});

export const TerminalCreateSchema = z.object({
  type: z.literal('terminal.create'),
  cwd: z.string().optional(),
  shell: z.string().optional(),
  cols: z.number().int().min(1).max(500).default(120),
  rows: z.number().int().min(1).max(200).default(30),
});

export const TerminalInputSchema = z.object({
  type: z.literal('terminal.input'),
  terminalId: z.string().min(1, 'terminalId is required'),
  data: z.string(),
});

export const TerminalResizeSchema = z.object({
  type: z.literal('terminal.resize'),
  terminalId: z.string().min(1, 'terminalId is required'),
  cols: z.number().int().min(1).max(500),
  rows: z.number().int().min(1).max(200),
});

export const TerminalKillSchema = z.object({
  type: z.literal('terminal.kill'),
  terminalId: z.string().min(1, 'terminalId is required'),
});

export const TerminalCloseSchema = z.object({
  type: z.literal('terminal.close'),
  terminalId: z.string().min(1, 'terminalId is required'),
});

export const PingMessageSchema = z.object({
  type: z.literal('ping'),
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  AuthMessageSchema,
  TerminalCreateSchema,
  TerminalInputSchema,
  TerminalResizeSchema,
  TerminalKillSchema,
  TerminalCloseSchema,
  PingMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type TerminalCreateMessage = z.infer<typeof TerminalCreateSchema>;
export type TerminalInputMessage = z.infer<typeof TerminalInputSchema>;
export type TerminalResizeMessage = z.infer<typeof TerminalResizeSchema>;
export type TerminalKillMessage = z.infer<typeof TerminalKillSchema>;
export type TerminalCloseMessage = z.infer<typeof TerminalCloseSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;

// Outgoing Server Messages
export interface AuthSuccessMessage {
  type: 'auth.success';
}

export interface AuthErrorMessage {
  type: 'auth.error';
  message: string;
}

export interface TerminalCreatedMessage {
  type: 'terminal.created';
  terminalId: string;
  cwd: string;
  shell: string;
}

export interface TerminalOutputMessage {
  type: 'terminal.output';
  terminalId: string;
  data: string;
}

export interface TerminalExitMessage {
  type: 'terminal.exit';
  terminalId: string;
  exitCode: number;
  signal?: number | string | null;
}

export interface TerminalErrorMessage {
  type: 'terminal.error';
  terminalId?: string;
  message: string;
}

export interface PongMessage {
  type: 'pong';
}

export type ServerMessage =
  | AuthSuccessMessage
  | AuthErrorMessage
  | TerminalCreatedMessage
  | TerminalOutputMessage
  | TerminalExitMessage
  | TerminalErrorMessage
  | PongMessage;

export class Protocol {
  public static parseClientMessage(raw: string): ClientMessage {
    const json = JSON.parse(raw);
    return ClientMessageSchema.parse(json);
  }

  public static serializeServerMessage(msg: ServerMessage): string {
    return JSON.stringify(msg);
  }
}
