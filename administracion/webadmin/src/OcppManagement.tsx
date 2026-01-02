import React, { useEffect, useState } from 'react';
import { 
  getChargers, 
  type Charger,
  remoteStartTransaction,
  remoteStopTransaction,
  resetCharger,
  unlockConnector,
  changeConfiguration,
  getConfiguration,
  updateFirmware,
  getDiagnostics,
  setChargingProfile,
  changeChargerAvailability,
  clearChargerCache
} from './api';

interface OcppCommand {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

const OcppManagement: React.FC = () => {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [commandResponse, setCommandResponse] = useState<any>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Comandos OCPP disponibles
  const ocppCommands: OcppCommand[] = [
    {
      name: 'RemoteStartTransaction',
      description: 'Iniciar una sesión de carga remotamente',
      parameters: [
        { name: 'userId', type: 'number', required: true, description: 'ID del usuario' }
      ]
    },
    {
      name: 'RemoteStopTransaction',
      description: 'Detener una sesión de carga remotamente',
      parameters: [
        { name: 'transactionId', type: 'number', required: true, description: 'ID de la transacción' }
      ]
    },
    {
      name: 'Reset',
      description: 'Reiniciar el cargador',
      parameters: [
        { name: 'type', type: 'string', required: true, description: 'Tipo de reinicio (Hard/Soft)' }
      ]
    },
    {
      name: 'UnlockConnector',
      description: 'Desbloquear un conector del cargador',
      parameters: [
        { name: 'connectorId', type: 'number', required: true, description: 'ID del conector' }
      ]
    },
    {
      name: 'ChangeConfiguration',
      description: 'Cambiar una configuración del cargador',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Clave de configuración' },
        { name: 'value', type: 'string', required: true, description: 'Valor de configuración' }
      ]
    },
    {
      name: 'GetConfiguration',
      description: 'Obtener configuración actual del cargador',
      parameters: [
        { name: 'keys', type: 'string[]', required: false, description: 'Lista de claves específicas' }
      ]
    },
    {
      name: 'UpdateFirmware',
      description: 'Iniciar actualización de firmware',
      parameters: [
        { name: 'location', type: 'string', required: true, description: 'URL del firmware' },
        { name: 'retrieveDate', type: 'string', required: true, description: 'Fecha de inicio de descarga' },
        { name: 'retries', type: 'number', required: false, description: 'Número de reintentos' },
        { name: 'retryInterval', type: 'number', required: false, description: 'Intervalo entre reintentos' }
      ]
    },
    {
      name: 'GetDiagnostics',
      description: 'Solicitar diagnósticos del cargador',
      parameters: [
        { name: 'location', type: 'string', required: true, description: 'URL donde enviar diagnósticos' },
        { name: 'startTime', type: 'string', required: false, description: 'Fecha de inicio' },
        { name: 'stopTime', type: 'string', required: false, description: 'Fecha de fin' },
        { name: 'retries', type: 'number', required: false, description: 'Número de reintentos' },
        { name: 'retryInterval', type: 'number', required: false, description: 'Intervalo entre reintentos' }
      ]
    },
    {
      name: 'SetChargingProfile',
      description: 'Establecer perfil de carga',
      parameters: [
        { name: 'connectorId', type: 'number', required: true, description: 'ID del conector' },
        { name: 'chargingProfile', type: 'object', required: true, description: 'Perfil de carga' }
      ]
    },
    {
      name: 'ChangeAvailability',
      description: 'Cambiar disponibilidad del cargador',
      parameters: [
        { name: 'connectorId', type: 'number', required: true, description: 'ID del conector' },
        { name: 'type', type: 'string', required: true, description: 'Tipo (Operative/Inoperative)' }
      ]
    },
    {
      name: 'ClearCache',
      description: 'Limpiar caché de autorización',
      parameters: []
    }
  ];

  const [selectedCommand, setSelectedCommand] = useState(ocppCommands[0].name);
  const [commandParams, setCommandParams] = useState<Record<string, any>>({});

  useEffect(() => {
    setLoading(true);
    getChargers()
      .then((response) => {
        setChargers(response.chargers || []);
        setAuthError(false);
      })
      .catch((error: any) => {
        console.error('Error fetching chargers:', error);
        if (error.message && error.message.includes('401')) {
          setAuthError(true);
          setMessage('❌ Error de autenticación. Por favor, inicia sesión primero.');
        } else {
          setMessage('❌ Error al cargar la lista de cargadores');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Actualizar parámetros cuando se cambia el comando seleccionado
  useEffect(() => {
    const command = ocppCommands.find(cmd => cmd.name === selectedCommand);
    if (command) {
      const initialParams: Record<string, any> = {};
      command.parameters.forEach(param => {
        initialParams[param.name] = '';
      });
      setCommandParams(initialParams);
    }
  }, [selectedCommand]);

  const handleParamChange = (paramName: string, value: string) => {
    setCommandParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleExecuteCommand = async () => {
    if (!selectedSerial) {
      setMessage('⚠️ Selecciona un cargador');
      return;
    }

    const command = ocppCommands.find(cmd => cmd.name === selectedCommand);
    if (!command) {
      setMessage('❌ Comando no válido');
      return;
    }

    // Validar parámetros requeridos
    for (const param of command.parameters) {
      if (param.required && (!commandParams[param.name] || commandParams[param.name] === '')) {
        setMessage(`⚠️ El parámetro ${param.name} es requerido`);
        return;
      }
    }

    setLoading(true);
    setMessage('');
    setCommandResponse(null);
    setShowResponse(false);

    try {
      // Check authentication before executing command
      if (authError) {
        throw new Error('401: Unauthorized');
      }

      let result: any;

      // Ejecutar el comando correspondiente
      switch (selectedCommand) {
        case 'RemoteStartTransaction':
          result = await remoteStartTransaction(
            selectedSerial, 
            Number(commandParams.userId)
          );
          break;
          
        case 'RemoteStopTransaction':
          result = await remoteStopTransaction(
            selectedSerial, 
            Number(commandParams.transactionId)
          );
          break;
          
        case 'Reset':
          result = await resetCharger(
            selectedSerial, 
            commandParams.type
          );
          break;
          
        case 'UnlockConnector':
          result = await unlockConnector(
            selectedSerial, 
            Number(commandParams.connectorId)
          );
          break;
          
        case 'ChangeConfiguration':
          result = await changeConfiguration(
            selectedSerial, 
            commandParams.key,
            commandParams.value
          );
          break;
          
        case 'GetConfiguration':
          result = await getConfiguration(
            selectedSerial, 
            commandParams.keys ? commandParams.keys.split(',').map((s: string) => s.trim()) : undefined
          );
          break;
          
        case 'UpdateFirmware':
          result = await updateFirmware(
            selectedSerial,
            commandParams.location,
            commandParams.retrieveDate,
            commandParams.retries ? Number(commandParams.retries) : undefined,
            commandParams.retryInterval ? Number(commandParams.retryInterval) : undefined
          );
          break;
          
        case 'GetDiagnostics':
          result = await getDiagnostics(
            selectedSerial,
            commandParams.location,
            commandParams.startTime,
            commandParams.stopTime,
            commandParams.retries ? Number(commandParams.retries) : undefined,
            commandParams.retryInterval ? Number(commandParams.retryInterval) : undefined
          );
          break;
          
        case 'SetChargingProfile':
          result = await setChargingProfile(
            selectedSerial,
            Number(commandParams.connectorId),
            typeof commandParams.chargingProfile === 'string' 
              ? JSON.parse(commandParams.chargingProfile) 
              : commandParams.chargingProfile
          );
          break;
          
        case 'ChangeAvailability':
          result = await changeChargerAvailability(
            selectedSerial,
            Number(commandParams.connectorId),
            commandParams.type
          );
          break;
          
        case 'ClearCache':
          result = await clearChargerCache(selectedSerial);
          break;
          
        default:
          throw new Error(`Comando no implementado: ${selectedCommand}`);
      }

      setCommandResponse(result);
      setShowResponse(true);
      setMessage('✅ Comando ejecutado correctamente');
    } catch (error: any) {
      console.error('Error executing command:', error);
      if (error.message && error.message.includes('401')) {
        setAuthError(true);
        setMessage('❌ Error de autenticación. Por favor, inicia sesión primero.');
      } else {
        setMessage(`❌ Error al ejecutar comando: ${error.message || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getCommandByName = (name: string) => {
    return ocppCommands.find(cmd => cmd.name === name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-4xl">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">📡 Gestión OCPP de Cargadores</h2>
        
        {authError && (
          <div className="mb-5 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h3 className="font-bold text-lg">Error de Autenticación</h3>
            <p>Para usar esta funcionalidad, necesitas iniciar sesión en la aplicación principal primero.</p>
            <p className="mt-2 text-sm">En una implementación completa, se requeriría un sistema de autenticación real.</p>
          </div>
        )}
        
        {message && (
          <div
            className={`mb-5 text-center font-medium transition-all ${
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Selecciona el cargador</label>
            <select
              value={selectedSerial}
              onChange={(e) => setSelectedSerial(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || authError}
            >
              <option value="">-- Selecciona --</option>
              {chargers.map((charger) => (
                <option key={charger.id} value={charger.serial_number}>
                  {charger.name} ({charger.serial_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Selecciona comando OCPP</label>
            <select
              value={selectedCommand}
              onChange={(e) => setSelectedCommand(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || authError}
            >
              {ocppCommands.map((command) => (
                <option key={command.name} value={command.name}>
                  {command.name} - {command.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCommand && !authError && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Parámetros para {selectedCommand}
            </h3>
            
            <div className="space-y-3">
              {getCommandByName(selectedCommand)?.parameters.map((param) => (
                <div key={param.name}>
                  <label className="block text-gray-700 text-sm mb-1">
                    {param.name} ({param.type}) {param.required ? '*' : '(opcional)'} - {param.description}
                  </label>
                  {param.type === 'string[]' ? (
                    <textarea
                      value={commandParams[param.name] || ''}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Valores separados por comas"
                      disabled={loading}
                      rows={2}
                    />
                  ) : param.type === 'object' ? (
                    <textarea
                      value={commandParams[param.name] || ''}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder='{"clave": "valor"}'
                      disabled={loading}
                      rows={3}
                    />
                  ) : (
                    <input
                      type={param.type === 'number' ? 'number' : 'text'}
                      value={commandParams[param.name] || ''}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={param.description}
                      disabled={loading}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!authError && (
          <button
            onClick={handleExecuteCommand}
            disabled={loading || !selectedSerial}
            className={`w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 mb-6 ${
              loading || !selectedSerial
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {loading ? 'Ejecutando...' : 'Ejecutar Comando OCPP'}
          </button>
        )}

        {showResponse && commandResponse && (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-800">Respuesta del Comando</h3>
              <button 
                onClick={() => setShowResponse(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Cerrar
              </button>
            </div>
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-auto max-h-60 text-sm">
              {JSON.stringify(commandResponse, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">Comandos OCPP Disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ocppCommands.map((command) => (
              <div key={command.name} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-600">{command.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{command.description}</p>
                <div className="mt-2">
                  <span className="text-xs font-medium text-gray-500">Parámetros:</span>
                  <ul className="text-xs text-gray-600 mt-1">
                    {command.parameters.length > 0 ? (
                      command.parameters.map(param => (
                        <li key={param.name}>
                          {param.name} ({param.type}) {param.required ? '*' : '(opcional)'}
                        </li>
                      ))
                    ) : (
                      <li>No requiere parámetros</li>
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcppManagement;