import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './index.css'; // Asegúrate de que esté aquí


interface Charger {
  serial: string;
  name?: string;
}

const AdminSetPrice: React.FC = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [basePrice, setBasePrice] = useState(''); // Solo lectura
  const [priceGrid, setPriceGrid] = useState('');
  const [priceSolar, setPriceSolar] = useState('');
  const [priceMixed, setPriceMixed] = useState('');
  const [priceSurplus, setPriceSurplus] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingBase, setEditingBase] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get('http://localhost:5000/api/chargers/list')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setChargers(
            res.data.map((d) => ({
              serial: d.serial,
              name: d.name || `Cargador ${d.serial}`,
            }))
          );
        }
      })
      .catch((error) => {
        console.error('Error en la petición:', error);
        setMessage('❌ Error al cargar la lista de cargadores');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Al seleccionar un cargador, cargar precios actuales
    if (!selectedSerial) {
      setBasePrice('');
      setPriceGrid('');
      setPriceSolar('');
      setPriceMixed('');
      setPriceSurplus('');
      return;
    }
    setLoading(true);
    axios
      .get(`http://localhost:5000/api/chargers/pricing/${selectedSerial}`)
      .then((res) => {
        const data = res.data;
        setBasePrice(data.base_price_per_kwh !== undefined ? String(data.base_price_per_kwh) : '');
        setPriceGrid(data.price_grid !== undefined ? String(data.price_grid) : '');
        setPriceSolar(data.price_solar !== undefined ? String(data.price_solar) : '');
        setPriceMixed(data.price_mixed !== undefined ? String(data.price_mixed) : '');
        setPriceSurplus(data.price_surplus !== undefined ? String(data.price_surplus) : '');
      })
      .catch(() => {
        setBasePrice('');
        setPriceGrid('');
        setPriceSolar('');
        setPriceMixed('');
        setPriceSurplus('');
      })
      .finally(() => setLoading(false));
  }, [selectedSerial]);

  const handleSave = async () => {
    if (!selectedSerial) {
      setMessage('⚠️ Selecciona un cargador');
      return;
    }
    // Validar precios
    const grid = parseFloat(priceGrid);
    const solar = priceSolar ? parseFloat(priceSolar) : undefined;
    const mixed = priceMixed ? parseFloat(priceMixed) : undefined;
    const surplus = priceSurplus ? parseFloat(priceSurplus) : undefined;
    const base = parseFloat(basePrice);
    if (isNaN(grid) || grid < 0) {
      setMessage('⚠️ Precio de Red inválido');
      return;
    }
    if (isNaN(base) || base < 0) {
      setMessage('⚠️ Precio base inválido');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await axios.post('http://localhost:5000/api/chargers/pricing', {
        serial_number: selectedSerial,
        base_price_per_kwh: base,
        price_grid: grid,
        price_solar: solar,
        price_mixed: mixed,
        price_surplus: surplus,
      });
      if (response.data.success) {
        setMessage('✅ Precios actualizados correctamente');
        setEditingBase(false);
      } else {
        setMessage(response.data.error || '❌ Error al actualizar los precios');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setMessage(error.response?.data?.error || '❌ Error de conexión');
      } else {
        setMessage('❌ Error desconocido al actualizar los precios');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">🔌 Precios por kWh</h2>
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">Selecciona el cargador</label>
          <select
            value={selectedSerial}
            onChange={(e) => setSelectedSerial(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Selecciona --</option>
            {chargers.map((c) => (
              <option key={c.serial} value={c.serial}>
                {c.name} ({c.serial})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-gray-700 font-medium mb-1">Precio base</label>
            <input
              type="number"
              value={basePrice}
              readOnly={!editingBase}
              onChange={e => setBasePrice(e.target.value)}
              className={`w-full border border-gray-300 rounded-lg px-4 py-3 ${editingBase ? '' : 'bg-gray-100 text-gray-500'}`}
            />
          </div>
          <button
            type="button"
            className={`ml-2 px-3 py-2 rounded-lg text-sm font-semibold ${editingBase ? 'bg-blue-200 text-blue-800' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            onClick={() => setEditingBase(!editingBase)}
          >
            {editingBase ? 'Bloquear' : 'Editar precio base'}
          </button>
        </div>
        <div className="mb-2">
          <label className="block text-gray-700 font-medium mb-1">Precio Red (Grid)</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={priceGrid}
            onChange={(e) => setPriceGrid(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3"
          />
        </div>
        <div className="mb-2">
          <label className="block text-gray-700 font-medium mb-1">Precio Solar</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={priceSolar}
            onChange={(e) => setPriceSolar(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3"
          />
        </div>
        <div className="mb-2">
          <label className="block text-gray-700 font-medium mb-1">Precio Mixto</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={priceMixed}
            onChange={(e) => setPriceMixed(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-1">Precio Excedentes</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={priceSurplus}
            onChange={(e) => setPriceSurplus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 ${
            loading
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
          }`}
        >
          {loading ? 'Guardando...' : 'Guardar precios'}
        </button>
        {message && (
          <div
            className={`mt-5 text-center font-medium transition-all ${
              message.includes('✅')
                ? 'text-green-600'
                : message.includes('⚠️')
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSetPrice;
