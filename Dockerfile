FROM php:8.2-cli-alpine

# Install system dependencies and required PHP extensions
RUN apk add --no-cache \
    curl \
    git \
    unzip \
    libzip-dev \
    oniguruma-dev \
    ca-certificates \
    && docker-php-ext-install pdo_mysql mbstring zip bcmath

# Install Composer from official image
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Copy composer definitions
COPY composer.json ./

# Install production dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Copy entire application
COPY . .

# Default port for Render (Render will inject $PORT)
ENV PORT=10000
EXPOSE 10000

# Start PHP built-in server serving public/ front-controller
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT} -t public"]

