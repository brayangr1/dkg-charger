#!/bin/bash

# 🔧 SCRIPT PARA ARREGLAR WEBSOCKET EN PRODUCCIÓN
# 
# Uso: bash fix_websocket.sh
# Requiere: sudo

set -e

echo "================================"
echo "🔧 Arreglando configuración WebSocket"
echo "================================"

# Verificar si se ejecuta con sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse con sudo"
   exit 1
fi

echo ""
echo "1️⃣  Habilitando módulos de Apache..."
a2enmod rewrite
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod ssl

echo ""
echo "2️⃣  Verificando módulos activos..."
apache2ctl -M | grep -E "rewrite|proxy|ssl"

echo ""
echo "3️⃣  Validando configuración de Apache..."
if apache2ctl configtest; then
    echo "✅ Configuración válida"
else
    echo "❌ Error en configuración. Revisar /etc/apache2/sites-available/server.dkgsolutions.es.conf"
    exit 1
fi

echo ""
echo "4️⃣  Reiniciando Apache..."
systemctl restart apache2

echo ""
echo "5️⃣  Verificando estado de Apache..."
if systemctl is-active --quiet apache2; then
    echo "✅ Apache está corriendo"
else
    echo "❌ Apache no está corriendo"
    exit 1
fi

echo ""
echo "6️⃣  Verificando Puerto 5010 (Node.js)..."
if netstat -tlnp 2>/dev/null | grep -q 5010; then
    echo "✅ Node.js está escuchando en puerto 5010"
else
    echo "⚠️  Node.js NO está escuchando en puerto 5010"
    echo "   Inicia el servidor: npm run dev"
fi

echo ""
echo "7️⃣  Verificando certificado SSL..."
certbot certificates | grep -A 5 "server.dkgsolutions.es"

echo ""
echo "================================"
echo "✅ Configuración completada"
echo "================================"
echo ""
echo "Próximos pasos:"
echo "1. Asegúrate que Node.js esté corriendo en puerto 5010"
echo "2. Prueba desde el navegador:"
echo "   const ws = new WebSocket('wss://server.dkgsolutions.es/ws?token=...');"
echo "3. Ver logs: tail -f /var/log/apache2/error.log"
echo ""
