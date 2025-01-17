# Etapa de construcción
FROM node:21-alpine3.18 as builder

# Habilitar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Configuración del directorio de trabajo
WORKDIR /app

# Copiar archivos esenciales para instalar dependencias
COPY package*.json pnpm-lock.yaml ./

# Instalar dependencias necesarias para desarrollo
RUN pnpm install

# Copiar el resto del código y construir el proyecto
COPY . .
RUN pnpm build

# Etapa de producción
FROM node:21-alpine3.18 as deploy

# Establecer variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Configurar el directorio de trabajo
WORKDIR /app

# Copiar la aplicación ya construida y los archivos necesarios
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Instalar solo dependencias de producción
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --production

# Exponer el puerto de la aplicación
EXPOSE 3000

RUN npm install -g eslint

# Comando de inicio
CMD ["pnpm", "start"]
