# 🔴 ERROR FIREBASE: "Invalid JWT Signature"

## El Problema

```
Credential implementation provided to initializeApp() via the "credential" property 
failed to fetch a valid Google OAuth2 access token with the following error: 
"invalid_grant: Invalid JWT Signature."
```

## ⚠️ Causas Posibles

### 1️⃣ **PROBABLE: Reloj del servidor desincronizado** (70% posibilidad)

Google valida JWTs usando timestamps. Si tu servidor tiene una hora incorrecta, Firebase rechaza la autenticación.

**Síntomas**:
- Error "invalid_grant: Invalid JWT Signature"
- Ocurre aleatoriamente
- Funciona a veces

### 2️⃣ **Credenciales de Firebase revocadas/expiradas** (20% posibilidad)

La clave de servicio puede haber sido eliminada de Google Cloud Console.

### 3️⃣ **Archivo de credenciales corrupto** (10% posibilidad)

El archivo `serviceAccountKey.json` está dañado o mal formateado.

---

## ✅ SOLUCIONES (En tu servidor)

### PASO 1: Sincronizar la hora del servidor

**Verificar hora actual:**
```bash
# Ver fecha y hora
date

# Ver zona horaria
timedatectl
```

**Si está desincronizada:**
```bash
# Opción A: Sincronizar con NTP (automático)
sudo apt-get install ntp
sudo systemctl start ntp
sudo systemctl enable ntp

# Opción B: Sincronizar manualmente (rápido)
sudo timedatectl set-ntp true

# Opción C: Actualizar zona horaria (si es incorrecta)
sudo timedatectl set-timezone Europe/Madrid
```

**Verificar después:**
```bash
# Debe mostrar "System clock synchronized: yes"
timedatectl

# Ver hora UTC
date -u
```

### PASO 2: Verificar archivo de credenciales

**Ubicación**: `/var/www/server/servidorapp/config/serviceAccountKey.json`

**Verificar que existe y es válido:**
```bash
# Verificar que existe
ls -la /var/www/server/servidorapp/config/serviceAccountKey.json

# Validar JSON
cat /var/www/server/servidorapp/config/serviceAccountKey.json | jq .

# Si jq no está instalado:
python3 -m json.tool /var/www/server/servidorapp/config/serviceAccountKey.json
```

**Debe tener este contenido:**
```json
{
  "type": "service_account",
  "project_id": "tu-proyecto-firebase",
  "private_key_id": "xxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com",
  "client_id": "xxxxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com"
}
```

### PASO 3: Regenerar credenciales de Firebase (si es necesario)

**Si el archivo es viejo o sospechoso:**

1. Ve a: https://console.firebase.google.com
2. Selecciona tu proyecto
3. **Project Settings** → **Service Accounts**
4. Click en **Generate New Private Key**
5. Se descargará un nuevo `json`
6. **Reemplaza** el archivo en tu servidor

**Copiar el archivo (desde tu máquina local):**
```bash
# Primero descargarlo desde Firebase Console
# Luego subirlo al servidor:

scp /ruta/local/serviceAccountKey.json \
    tu_usuario@server.dkgsolutions.es:/tmp/

# En el servidor:
sudo mv /tmp/serviceAccountKey.json \
    /var/www/server/servidorapp/config/serviceAccountKey.json

# Verificar permisos
sudo chown nodejs:nodejs /var/www/server/servidorapp/config/serviceAccountKey.json
sudo chmod 600 /var/www/server/servidorapp/config/serviceAccountKey.json
```

### PASO 4: Reiniciar aplicación Node.js

```bash
# Si está corriendo con PM2:
pm2 restart all
pm2 logs

# Si está corriendo manualmente:
# Presiona Ctrl+C y reinicia
npm run dev
```

---

## 🔧 SCRIPT RÁPIDO PARA SINCRONIZAR HORA

Copia esto en tu servidor:

```bash
#!/bin/bash

echo "🕐 Sincronizando reloj del servidor..."

# Verificar hora actual
echo "Hora antes:"
date

# Sincronizar hora
sudo timedatectl set-ntp true

# Esperar unos segundos
sleep 3

# Verificar hora sincronizada
echo ""
echo "Hora después:"
date

echo ""
echo "Estado NTP:"
timedatectl

# Reiniciar aplicación si está corriendo
if command -v pm2 &> /dev/null; then
    echo ""
    echo "Reiniciando aplicación Node.js..."
    pm2 restart all
fi
```

Guárdalo como `sync_time.sh` y ejecuta:
```bash
chmod +x sync_time.sh
./sync_time.sh
```

---

## 🧪 PRUEBA RÁPIDA

Desde tu máquina local, intenta login:

1. **Abre la consola del navegador** (F12)
2. **Ve a la sección de Network**
3. **Intenta hacer login**
4. **Busca el error**: debería haber desaparecido

Si aún falla:
```javascript
// En consola del navegador
console.log(new Date());
// Compara con la hora del servidor

// Ver logs del servidor
```

---

## 📋 CHECKLIST

- [ ] Verificar hora del servidor: `date`
- [ ] Sincronizar con NTP: `sudo timedatectl set-ntp true`
- [ ] Validar archivo JSON: `cat file | jq .`
- [ ] Permisos correctos: `chmod 600`
- [ ] Reiniciar Node.js
- [ ] Intentar login nuevamente
- [ ] Ver logs: `pm2 logs` o `tail -f`

---

## 🚨 Si AÚN falla

1. **Verificar que Firebase está corriendo:**
   ```bash
   # En servidor
   curl -I http://localhost:5010/api/health
   # Debe retornar 200
   ```

2. **Verificar credenciales:**
   ```bash
   cat /var/www/server/servidorapp/config/serviceAccountKey.json | jq '.client_email'
   ```

3. **Ver logs detallados:**
   ```bash
   pm2 logs --lines 100 | tail -50
   ```

4. **Regenerar credenciales:**
   - Ve a https://console.firebase.google.com
   - Project Settings → Service Accounts
   - Delete old key
   - Generate new key
   - Upload to server

---

## 📞 CONTACTO

Si el problema persiste después de:
- [ ] Sincronizar hora
- [ ] Validar credenciales
- [ ] Regenerar keys

Proporciona logs:
```bash
pm2 logs > logs.txt 2>&1
# y comparte el contenido
```

---

**El 90% de estos errores se resuelven sincronizando la hora del servidor.**

Empieza por:
```bash
sudo timedatectl set-ntp true
# Espera 10 segundos
systemctl restart nodejs  # o pm2 restart all
```

¡Inténtalo y reporta si funciona!
