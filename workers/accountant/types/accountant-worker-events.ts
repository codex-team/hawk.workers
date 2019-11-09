/**
 * Types definitions for accountant worker
 */

/**
 * Transaction types
 */
export enum TransactionType {
  /**
   * For payments
   */
  Income = 'income',

  /**
   * For expenses
   */
  Charge = 'charge',
}

/**
 * Accountant worker event type
 */
export enum EventType {
  Transaction = 'transaction',
}

/**
 * Accountant worker task interface
 */
export interface AccountantEvent {
  /**
   * Type of the event
   */
  type: EventType;
  /**
   * Event payload
   */
  payload: AccountantEventPayload;
}

/**
 * Transaction event interface
 */
export interface TransactionEvent extends AccountantEvent {
  type: EventType.Transaction;
  payload: IncomeTransactionPayload | ChargeTransactionPayload;
}

/**
 * Common transaction payload properties
 */
export interface TransactionPayload {
  /**
   * Transaction type — 'income' or 'charge'
   */
  type: TransactionType;

  /**
   * Timestamp of the transaction date
   */
  date: number;

  /**
   * Workspace for which transaction has been made
   */
  workspaceId: string;

  /**
   * Transaction amount
   */
  amount: number;
}

export interface IncomeTransactionPayload extends TransactionPayload {
  type: TransactionType.Income;

  /**
   * Pan code of the card payment has been made by
   */
  cardPan: number;

  /**
   * Id of user who has been proceeded transaction
   */
  userId: string;
}

export interface ChargeTransactionPayload extends TransactionPayload {
  type: TransactionType.Charge;
}

/**
 * General type for Accountant worker task payload
 */
export type AccountantEventPayload = IncomeTransactionPayload | ChargeTransactionPayload;
