import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export interface PaymentHistory {
  id: number;
  user_id: number;
  charger_id: number;
  session_id: number;
  amount: string;
  currency: string;
  status: string;
  payment_method_id: string;
  transaction_id: string;
  invoice_number: string;
  created_at: string;
  updated_at: string;
  charger_name: string;
  serial_number: string;
  start_time: string;
  end_time: string;
  total_energy: string;
  card_brand: string;
  last4: string;
}