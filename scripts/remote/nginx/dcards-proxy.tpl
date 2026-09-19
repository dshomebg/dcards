# Hestia nginx шаблон (HTTP) за dcards-bg.com — всичко към Next.js на 127.0.0.1:3010.
# Инсталира се в /usr/local/hestia/data/templates/web/nginx/php-fpm/ и се избира
# с `v-change-web-domain-tpl pagagal dcards-bg.com dcards-proxy`. Виж docs/go-live.md.
server {
    listen      %ip%:%web_port%;
    server_name %domain_idn% %alias_idn%;

    include %home%/%user%/conf/web/%domain%/nginx.forcessl.conf*;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        client_max_body_size 20M;
    }

    error_log  /var/log/%web_system%/domains/%domain%.error.log error;

    include %home%/%user%/conf/web/%domain%/nginx.conf_*;
}
