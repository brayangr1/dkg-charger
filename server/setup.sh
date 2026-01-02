#!/bin/bash

echo "🔧 Configurando servidor DKG Solutions..."

# Navegar al directorio
cd /var/www/server/servidorapp

# Verificar Node.js y npm
echo "📦 Verificando Node.js y npm..."
node --version
npm --version

# Instalar dependencias
echo "📥 Instalando dependencias..."
npm install

# Compilar TypeScript
echo "🔨 Compilando TypeScript..."
npm run build

# Probar la base de datos
echo "🗄️  Probando conexión a base de datos..."
mysql -h 127.0.0.1 -u appdkg -pDkg010203 -e "SHOW DATABASES;" || {
    echo "❌ Error conectando a MySQL"
    exit 1
}

echo "✅ Configuración completada"
echo "🚀 Para iniciar en desarrollo: npm run dev"
echo "🌐 Para producción: pm2 start ecosystem.config.js"