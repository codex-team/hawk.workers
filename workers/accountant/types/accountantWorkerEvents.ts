/**
 * Types definitions for accountant worker
 */

export enum TransactionType {
  Income = 'income',
  Charge = 'charge'
}

export enum EventType {
  Transaction = 'transaction',
}

export interface AccountantEvent {
  type: EventType;
  payload: AccountantEventPayload;
}

export interface TransactionEvent {
  type: EventType.Transaction;
  payload: IncomeTransactionPayload | ChargeTransactionPayload;
}

export interface TransactionPayload {
  type: string;
  date: number;
  workspaceId: string;
  amount: number;
}

export interface IncomeTransactionPayload extends TransactionPayload {
  type: TransactionType.Income;
  cardPan: number;
  userId: string;
}

export interface ChargeTransactionPayload extends TransactionPayload {
  type: TransactionType.Charge;
}

export type AccountantEventPayload = TransactionPayload;
