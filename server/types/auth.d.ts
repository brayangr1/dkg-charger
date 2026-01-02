import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    // Puedes agregar más campos según tu lógica de usuario
  };
} 