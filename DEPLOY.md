# deployment to pseudochan.org

## server requirements

- ubuntu 22.04+
- php 8.3
- nginx
- sqlite3
- composer
- git

## initial server setup

```bash
apt update && apt upgrade -y
apt install -y software-properties-common
add-apt-repository ppa:ondrej/php -y
apt update

apt install -y nginx php8.3-fpm php8.3-cli php8.3-sqlite3 php8.3-curl \
  php8.3-mbstring php8.3-xml php8.3-zip php8.3-gmp php8.3-bcmath \
  sqlite3 git certbot python3-certbot-nginx

curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
```

## clone and setup

```bash
cd /var/www
git clone https://github.com/nozmo-king/pseudo.git pseudochan
cd pseudochan/web-app

composer install --no-dev --optimize-autoloader

cp .env.example .env
```

## configure .env

```bash
nano .env
```

```
APP_NAME=Pseudochan
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://pseudochan.org

DB_CONNECTION=sqlite
DB_DATABASE=/var/www/pseudochan/web-app/database/database.sqlite

SESSION_DRIVER=database
SESSION_LIFETIME=10080

FILESYSTEM_DISK=public
```

## laravel setup

```bash
php artisan key:generate
touch database/database.sqlite
php artisan migrate --force
php artisan storage:link

chown -R www-data:www-data /var/www/pseudochan
chmod -R 755 /var/www/pseudochan
chmod -R 775 storage bootstrap/cache
chmod 664 database/database.sqlite

php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## nginx config

```bash
nano /etc/nginx/sites-available/pseudochan
```

```nginx
server {
    listen 80;
    server_name pseudochan.org www.pseudochan.org;
    root /var/www/pseudochan/web-app/public;
    index index.html index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

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

    client_max_body_size 10M;
}
```

```bash
ln -s /etc/nginx/sites-available/pseudochan /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## ssl certificate

```bash
certbot --nginx -d pseudochan.org -d www.pseudochan.org
```

## initialize data

```bash
cd /var/www/pseudochan/web-app
php artisan tinker
```

### create boards

```php
Board::updateOrCreate(['slug' => 'general'], ['name' => 'general', 'description' => 'general discussion', 'position' => 0]);
Board::updateOrCreate(['slug' => 'tech'], ['name' => 'technology', 'description' => 'technology and computing', 'position' => 1]);
Board::updateOrCreate(['slug' => 'crypto'], ['name' => 'crypto', 'description' => 'cryptocurrency and blockchain', 'position' => 2]);
Board::updateOrCreate(['slug' => 'meta'], ['name' => 'meta', 'description' => 'pseudochan discussion', 'position' => 3]);
exit
```

### create default chatroom

```bash
php artisan tinker
```

```php
$system = User::firstOrCreate(['pubkey' => 'system'], ['display_name' => 'system']);
Chatroom::firstOrCreate(['slug' => 'general'], ['name' => 'general', 'created_by_user_id' => $system->id, 'required_hash' => '21e8']);
exit
```

## make yourself admin

1. visit site, authenticate with your pubkey
2. find your pubkey in database or logs

```bash
php artisan tinker
```

```php
$user = User::where('pubkey', 'YOUR_PUBKEY')->first();
$user->is_admin = true;
$user->save();
exit
```

## updates

```bash
cd /var/www/pseudochan
git pull origin main
cd web-app
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## monitoring

```bash
tail -f /var/www/pseudochan/web-app/storage/logs/laravel.log
ls -lh /var/www/pseudochan/web-app/database/database.sqlite
```

## dns

point your domain to server ip:

```
A     pseudochan.org      YOUR_SERVER_IP
A     www.pseudochan.org  YOUR_SERVER_IP
```
