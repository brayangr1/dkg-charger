# ⚠️ SOLUCIÓN PARA CONECTAR WEBSOCKET

## 🔴 El Problema

El cliente Web intenta conectarse a `wss://server.dkgsolutions.es/ws` pero recibe:
```
NS_ERROR_WEBSOCKET_CONNECTION_REFUSED
```

## 🔍 Raíz del Problema

En el servidor Apache (`/etc/apache2/sites-available/server.dkgsolutions.es.conf`), **la configuración de WebSocket es incompleta**.

Actualmente tiene:
```apache
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteRule ^/ws(.*)$ ws://localhost:5010/ws$1 [P,L]
```

Pero le **falta**:
- ❌ Módulo `mod_proxy_wstunnel` habilitado
- ❌ Headers de Connection configurados
- ❌ ProxyUpgrade directive
- ❌ Verificación de `Connection: Upgrade` header

---

## ✅ PASOS PARA ARREGLARLO

### 1️⃣ EN TU SERVIDOR DE PRODUCCIÓN (Linux/Ubuntu)

```bash
# Conectarse al servidor
ssh tu_usuario@server.dkgsolutions.es

# Habilitamos módulos de Apache
sudo a2enmod rewrite
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod ssl

# Verificamos que los módulos estén activos
sudo apache2ctl -M | grep -E "rewrite|proxy|ssl"
```

### 2️⃣ Reemplazar el archivo de configuración

El archivo correcto está en:
📁 `c:\app\dkg\revision\app\server\server.dkgsolutions.es.conf.NEW`

**Pasos:**
```bash
# Hacer backup del archivo original
sudo cp /etc/apache2/sites-available/server.dkgsolutions.es.conf \
        /etc/apache2/sites-available/server.dkgsolutions.es.conf.backup

# Copiar el archivo nuevo (desde tu máquina local usando scp o manualmente)
# Opción 1: Copiar vía SCP
scp /ruta/local/server.dkgsolutions.es.conf.NEW \
    tu_usuario@server.dkgsolutions.es:/tmp/

# Opción 2: Editar directamente en el servidor
sudo nano /etc/apache2/sites-available/server.dkgsolutions.es.conf

# Copiar el contenido de server.dkgsolutions.es.conf.NEW al archivo
```

### 3️⃣ Validar la configuración

```bash
# Validar sintaxis
sudo apache2ctl configtest

# Debería mostrar:
# Syntax OK
```

### 4️⃣ Reiniciar Apache

```bash
# Reiniciar Apache para aplicar los cambios
sudo systemctl restart apache2

# Verificar estado
sudo systemctl status apache2

# Ver logs en tiempo real
sudo tail -f /var/log/apache2/error.log
```

### 5️⃣ Verificar que Node.js está corriendo

```bash
# En el servidor de aplicaciones
ps aux | grep "npm run"

# Debería estar corriendo el servidor Node.js

# Verificar el puerto 5010
netstat -tlnp | grep 5010

# Output esperado:
# tcp 0 0 0.0.0.0:5010 0.0.0.0:* LISTEN xxxxx/node
```

### 6️⃣ Probar desde el navegador

Abre la **consola del navegador** (F12) y ejecuta:

```javascript
// 1. Obtener el token (ya debería estar en localStorage)
const token = localStorage.getItem('auth_token') || 
              localStorage.getItem('token');

console.log('Token:', token);

// 2. Crear conexión WebSocket
const ws = new WebSocket(`wss://server.dkgsolutions.es/ws?token=${token}`);

// 3. Manejar eventos
ws.onopen = () => {
  console.log('✅ WebSocket CONECTADO');
  
  // Suscribirse a un cargador (reemplaza 123 con un ID real)
  ws.send(JSON.stringify({
    type: 'subscribe',
    chargerId: 123
  }));
};

ws.onmessage = (event) => {
  console.log('📡 Mensaje recibido:', event.data);
};

ws.onerror = (error) => {
  console.error('❌ Error WebSocket:', error);
};

ws.onclose = () => {
  console.log('👋 WebSocket DESCONECTADO');
};

// 4. Esperar respuesta (debería aparecer en consola)
```

---

## 📋 CHECKLIST DE VERIFICACIÓN

Antes de declarar que funciona:

- [ ] Apache reiniciado sin errores
- [ ] Módulos de proxy activos: `sudo apache2ctl -M | grep proxy`
- [ ] Node.js corriendo en puerto 5010
- [ ] WebSocket Server inicializado (ver en logs: "✅ WebSocket Server inicializado")
- [ ] Conexión desde navegador exitosa (onopen disparado)
- [ ] Mensaje de suscripción enviado correctamente
- [ ] Servidor recibe mensaje (ver en logs de Node.js)

---

## 🔧 DEBUGGING

### Si sigue sin funcionar:

**Ver logs de Apache:**
```bash
sudo tail -f /var/log/apache2/error.log | grep -i websocket
sudo tail -f /var/log/apache2/access.log | grep /ws
```

**Ver logs de Node.js:**
```bash
# Ir al directorio del servidor
cd /app/dkg/revision/app/server

# Ver logs en tiempo real
npm run dev 2>&1 | tee server.log

# O si ya está corriendo
tail -f logs/application.log  # o donde esté guardando logs
```

**Probar conectividad directa (sin Apache):**
```bash
# En el navegador, intentar conectar directamente (NO recomendado en prod)
const ws = new WebSocket('ws://localhost:5010/ws?token=...');

# Si esto funciona pero `wss://server.dkgsolutions.es/ws` no,
# el problema está en Apache
```

---

## 📝 NOTAS IMPORTANTES

1. **Token en URL**: El token JWT va en `?token=TOKEN`. Asegúrate que el token sea válido
2. **CORS**: El servidor Node.js maneja CORS, pero Apache también debe permitir headers
3. **SSL/TLS**: Asegúrate que el certificado Let's Encrypt esté vigente:
   ```bash
   sudo certbot certificates
   ```
4. **Firewall**: Si está en un servidor con firewall, asegúrate que:
   - Puerto 80 está abierto (redirige a HTTPS)
   - Puerto 443 está abierto (HTTPS)
   - Puerto 5010 está abierto localmente (para proxy de Apache)

---

## ✨ Después de arreglarlo

Una vez que funcione, deberías ver en el navegador:

**Consola JavaScript:**
```
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
✅ WebSocket CONECTADO
```

**Logs del servidor Node.js:**
```
✅ WebSocket Server inicializado en ruta /ws
✅ Usuario 60 conectado a WebSocket
✅ Usuario 60 suscrito al cargador 123
📡 Status Update - Cargador 123: charging (Enviado a 1/1 clientes)
```

¡Si ves esto, el WebSocket está funcionando correctamente!

---

**Problema identificado**: Configuración incompleta de Apache para WebSocket Secure (wss://)
**Solución**: Actualizar configuración Apache con soporte mod_proxy_wstunnel
**Tiempo estimado**: 10-15 minutos
