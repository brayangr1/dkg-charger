import { Router } from 'express';
import { syncAllDevices, syncChargerData } from '../../services/deviceSync.service';

const router = Router();

// POST /api/sync/sync-all
router.post('/sync-all', async (req, res) => {
  try {
    await syncAllDevices();
    res.json({ success: true, message: 'Todos los dispositivos sincronizados' });
  } catch (err) {
    console.error('❌ Error en sync-all:', err);
    res.status(500).json({ success: false, error: 'Error en sincronización global' });
  }
});

// POST /api/sync/:serial
router.post('/:serial', async (req, res) => {
  const { serial } = req.params;

  try {
    await syncChargerData(serial);
    res.json({ success: true, message: `Dispositivo ${serial} sincronizado` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al sincronizar' });
  }
});




export default router;
