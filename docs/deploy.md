# Pseudochan Deployment Guide

## Prerequisites

- PHP 8.3+
- Composer
- SQLite (or MySQL/PostgreSQL)
- Node.js 18+ and npm
- Web server (Apache/Nginx)

## First-Time Setup

```bash
# 1. Clone and navigate
git clone <repo> pseudochan
cd pseudochan/web-app

# 2. Install PHP dependencies
composer install --no-dev --optimize-autoloader

# 3. Environment configuration
cp .env.example .env

# Edit .env:
# - Set APP_NAME=Pseudochan
# - Set APP_URL to your domain
# - Set FILESYSTEM_DISK=public
# - Configure database if not using SQLite

# 4. Generate application key
php artisan key:generate

# 5. Run migrations
php artisan migrate --force

# 6. Link storage
php artisan storage:link

# 7. Install and build frontend assets
npm ci
npm run build

# 8. Clear caches
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 9. Set permissions
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

## Updating

```bash
git pull

composer install --no-dev --optimize-autoloader

php artisan migrate --force

npm ci
npm run build

php artisan config:clear
php artisan route:clear
php artisan view:clear
```

## Web Server Configuration

### Apache

```apache
<VirtualHost *:80>
    ServerName pseudochan.example
    DocumentRoot /var/www/pseudochan/web-app/public

    <Directory /var/www/pseudochan/web-app/public>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/pseudochan-error.log
    CustomLog ${APACHE_LOG_DIR}/pseudochan-access.log combined
</VirtualHost>
```

### Nginx

```nginx
server {
    listen 80;
    server_name pseudochan.example;
    root /var/www/pseudochan/web-app/public;

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

## Production Checklist

- [ ] Set `APP_ENV=production` in .env
- [ ] Set `APP_DEBUG=false` in .env
- [ ] Configure proper database (not SQLite for production)
- [ ] Set up HTTPS with SSL certificate
- [ ] Configure PHP opcache
- [ ] Set up queue workers if using queues
- [ ] Configure log rotation
- [ ] Set up backups for database and storage
- [ ] Monitor disk space (POW table grows quickly)

## Troubleshooting

**"could not find driver" error:**
```bash
apt-get install php8.3-sqlite3  # for SQLite
# or
apt-get install php8.3-mysql    # for MySQL
```

**Storage symlink not working:**
```bash
php artisan storage:link
```

**Permission errors:**
```bash
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

## Monitoring

Monitor these metrics:
- `proof_of_work` table size (can grow large)
- Storage disk usage (`storage/app/public/images`)
- Database query performance on POW sum queries
- User session storage
