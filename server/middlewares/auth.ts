import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { connectionPool } from '../config/db.config';
import { RowDataPacket } from 'mysql2/promise';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}


export const verifyToken = (token: string) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está configurado');
  }
  return jwt.verify(token, process.env.JWT_SECRET) as { id: number; email: string };
};

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
      id: number;
      email: string;
    };
    
    // Verificar que el usuario existe en la base de datos
    const [userRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id, email FROM users WHERE id = ?',
      [decoded.id]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    req.user = {
      id: userRows[0].id,
      email: userRows[0].email
    };

    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};