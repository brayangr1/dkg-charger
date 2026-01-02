# 🔴 PROBLEMA: WebSocket No Se Conecta

## Error
```
NS_ERROR_WEBSOCKET_CONNECTION_REFUSED
Firefox can't establish a connection to the server at wss://server.dkgsolutions.es/ws
```

## Causa Raíz

El archivo de configuración Apache (`server.dkgsolutions.es.conf`) tiene configuraciones de WebSocket **incompletas y incorrectas**:

**Líneas problemáticas (45-47):**
```apache
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteRule ^/ws(.*)$ ws://localhost:5010/ws$1 [P,L]
```

### Problemas:
1. ❌ Usa `ws://` en lugar de `wss://` para WebSocket Secure
2. ❌ Le falta la configuración de headers para proxy WebSocket
3. ❌ Le falta `ProxyUpgrade` directive
4. ❌ Le falta `Connection` header para WebSocket
5. ❌ RewriteEngine no está habilitado

---

## ✅ SOLUCIÓN

### Paso 1: Editar `/etc/apache2/sites-available/server.dkgsolutions.es.conf`

Reemplazar la sección `<IfModule mod_ssl.c>` con esta configuración:

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>    
    ServerAdmin webmaster@dkgsolutions.es
    DocumentRoot /var/www/server/
    ServerName server.dkgsolutions.es
    ServerAlias server.dkgsolutions.es
    
    # ✅ HABILITAR MOD_REWRITE Y MOD_PROXY_WS
    RewriteEngine On
    ProxyRequests Off
    ProxyPreserveHost On
    
    # ✅ Configuración de WebSocket - CORRECTO
    # Detectar WebSocket upgrade request
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} Upgrade [NC]
    
    # Redirigir a WebSocket del servidor Node.js
    RewriteRule ^/ws(.*)$ ws://localhost:5010/ws$1 [P,L]
    
    # Configurar proxy para WebSocket
    <IfModule mod_proxy_wstunnel.c>
        ProxyPass /ws ws://localhost:5010/ws
        ProxyPassReverse /ws ws://localhost:5010/ws
    </IfModule>
    
    # Redirigir OCPP WebSocket también
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} Upgrade [NC]
    RewriteRule ^/ocpp(.*)$ ws://localhost:8887/ocpp$1 [P,L]
    
    <IfModule mod_proxy_wstunnel.c>
        ProxyPass /ocpp ws://localhost:8887/ocpp
        ProxyPassReverse /ocpp ws://localhost:8887/ocpp
    </IfModule>

    # Redirigir API calls a Node.js
    ProxyPass /api http://localhost:5010/api
    ProxyPassReverse /api http://localhost:5010/api
    
    # Redirigir todo el tráfico a Node.js
    ProxyPass / http://localhost:5010/
    ProxyPassReverse / http://localhost:5010/
    
    # Configuracion del directorio principal
    <Directory /var/www/server/>
        Options -Indexes +FollowSymLinks +MultiViews
        AllowOverride All
        Require all granted
        DirectoryIndex index.html index.php
    </Directory>

    Include /etc/letsencrypt/options-ssl-apache.conf
    SSLCertificateFile /etc/letsencrypt/live/electroprime.es/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/electroprime.es/privkey.pem

</VirtualHost>
</IfModule>
```

### Paso 2: Verificar módulos de Apache

```bash
# Habilitar módulos necesarios
sudo a2enmod rewrite
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod ssl

# Verificar sintaxis
sudo apache2ctl configtest
# Debe mostrar: Syntax OK

# Reiniciar Apache
sudo systemctl restart apache2
```

### Paso 3: Verificar que Node.js está escuchando

```bash
# Desde el servidor
netstat -tlnp | grep 5010

# Debería mostrar:
# tcp 0 0 0.0.0.0:5010 0.0.0.0:* LISTEN xxxxx/node
```

### Paso 4: Probar la conexión WebSocket

Desde la consola del navegador:
```javascript
// Obtener token primero
const token = localStorage.getItem('token');

// Intentar conectar
const ws = new WebSocket(`wss://server.dkgsolutions.es/ws?token=${token}`);

ws.onopen = () => {
  console.log('✅ WebSocket conectado');
  // Suscribirse a un cargador
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
  console.log('❌ WebSocket desconectado');
};
```

### Paso 5: Logs para debugging

Ver logs de Apache:
```bash
# Error log
tail -f /var/log/apache2/server.dkgsolutions.es_error.log

# Access log
tail -f /var/log/apache2/server.dkgsolutions.es_access.log

# Debug WebSocket
sudo tail -f /var/log/apache2/error.log | grep -i websocket
```

Ver logs del servidor Node.js:
```bash
cd /app/dkg/revision/app/server
npm run dev
# Debería ver:
# ✅ WebSocket Server inicializado en ruta /ws
# 🚀 Servidor corriendo en puerto 5010
```

---

## 🔍 Troubleshooting

### Error: "mod_proxy_wstunnel not found"
```bash
sudo apt-get install libapache2-mod-proxy-uwsgi
sudo a2enmod proxy_wstunnel
sudo systemctl restart apache2
```

### Error: "WebSocket connection refused"
1. Verificar que Node.js está corriendo: `ps aux | grep node`
2. Verificar puerto 5010: `netstat -tlnp | grep 5010`
3. Verificar reglas Apache: `sudo apache2ctl -t`
4. Revisar logs: `tail -f /var/log/apache2/error.log`

### Cliente conecta pero no recibe mensajes
- Verificar que el cliente está suscrito: `ws.send(JSON.stringify({type: 'subscribe', chargerId: 123}))`
- Verificar logs del servidor para ver si la suscripción se procesa

---

## 📊 Checklist

- [ ] Archivo `server.dkgsolutions.es.conf` actualizado
- [ ] Módulos de Apache habilitados (rewrite, proxy, proxy_wstunnel, ssl)
- [ ] Sintaxis de Apache válida (`sudo apache2ctl configtest`)
- [ ] Apache reiniciado (`sudo systemctl restart apache2`)
- [ ] Node.js escuchando en puerto 5010
- [ ] WebSocket Server inicializado en Node.js
- [ ] Certificado SSL válido (Let's Encrypt)
- [ ] Prueba de conexión exitosa desde navegador

---

**Después de hacer estos cambios, el WebSocket debería conectarse correctamente.**
