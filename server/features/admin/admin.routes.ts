// server/features/admin/admin.routes.ts
import { Router } from 'express';
import { connectionPool } from '../../config/db.config';

const router = Router();
router.get('/list-chargers', async (req, res) => {
  try {
    const [chargers] = await connectionPool.query('SELECT * FROM chargers ORDER BY serial_number');
    res.status(200).json({
      success: true,
      data: chargers,
      message: 'Cargadores obtenidos exitosamente'
    });
  } catch (error) {
    console.error('Error fetching chargers:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al cargar cargadores',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

router.post('/get-user', async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await connectionPool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (Array.isArray(users) && users.length > 0) {
      res.status(200).json({ 
        id: (users[0] as any).id
      });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al cargar usuario',
    })
  }
})

router.post('/get-chargers-email', async (req, res) => {
  const { email } = req.body;
  try {
    const [chargers] = await connectionPool.query(
      `SELECT c.* FROM chargers c
       JOIN charger_users uc ON c.id = uc.charger_id
       JOIN users u ON uc.user_id = u.id
       WHERE u.email = ? AND uc.access_level = 'owner'`,
      [email]
    );

    res.status(200).json({
      success: true,
      data: chargers,
      message: 'Cargadores obtenidos exitosamente para el usuario'
    });
  } catch (error) {
    console.error('Error fetching chargers for user:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al cargar cargadores para el usuario',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

router.post('/get-charger-users', async (req, res) => {
  const { serial } = req.body;
  try {
    const [users] = await connectionPool.query(
      `SELECT u.id, u.email FROM users u
      JOIN charger_users uc
      JOIN chargers c ON c.id = uc.charger_id
      WHERE u.id = uc.user_id AND c.serial_number = ?`,
      [serial]
    );

    res.status(200).json({
      success: true,
      data: users,
      message: 'Usuarios obtenidos exitosamente para el cargador'
    });
  } catch (error) {
    console.error('Error fetching chargers for user:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al cargar cargadores para el usuario',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});


export default router;
