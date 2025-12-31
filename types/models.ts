
export interface AuthCredentials {
    email: string;
    password: string;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    countryCode: string; // e.g., +237
    photoURL?: string | null;
    authProvider: 'password' | 'google' | 'apple' | string;
    createdAt: any;
    updatedAt: any;
}

export type User = UserProfile; // convenient alias for user objects across the app

export interface SignupPayload {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export type TransactionType = 'income' | 'expense' | 'debt' | 'repayment';

export interface Transaction {
  id: string;
  userId: string;
  amount: number; // stored in smallest currency unit (e.g., cents)
  type: TransactionType;
  category?: string;
  date: string; // ISO string
  notes?: string;
  createdAt?: any; // Firestore Timestamp or ISO
  counterpartyName?: string;
  debtId?: string;
  direction?: 'owed' | 'owing';
}

// New debt model
export interface Debt {
  id: string;
  ownerId: string; // who created the debt record
  counterpartyName: string; // the other user involved
  parties?: string[]; // convenience array of participant uids (owner + counterparty)
  amount: number; // original debt amount in main currency units (e.g., 120.50)
  remainingAmount?: number; // remaining balance after repayments
  currency?: string;
  direction: 'owed' | 'owing'; // owed = they owe me, owing = I owe them
  status?: 'pending' | 'partial' | 'paid'; // pending = no repayments, partial = some paid, paid = fully paid
  dueDate?: string; // ISO string
  notes?: string;
  reminderAt?: string | null; // ISO string for scheduled reminder
  notificationId?: string | null; // ID of the scheduled notification
  createdAt?: any; // Firestore Timestamp or ISO
  updatedAt?: any; // Firestore Timestamp or ISO
}

// Repayment model - tracks individual payments against a debt
export interface Repayment {
  id: string;
  userId: string; // who made this repayment record
  debtId: string; // reference to the debt being repaid
  transactionId?: string; // optional link to the transaction record
  amount: number; // repayment amount
  date: string; // ISO string
  notes?: string;
  counterpartyName?: string; // copied from debt for convenience
  direction?: 'owed' | 'owing'; // copied from debt
  previousBalance?: number; // debt balance before this repayment
  newBalance?: number; // debt balance after this repayment
  createdAt?: any; // Firestore Timestamp or ISO
  updatedAt?: any; // Firestore Timestamp or ISO
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type?: 'system' | 'debt' | 'recommendation' | string;
  read?: boolean;
  relatedId?: string;
  scheduledFor?: string; // ISO string for reminders
  createdAt?: any; // Firestore Timestamp or ISO
  readAt?: any; // Firestore Timestamp or ISO
}
