# SEO deploy checklist

## After deploy

1. Check that these URLs return `200`:
   - `https://qrstars.ru/robots.txt`
   - `https://qrstars.ru/sitemap.xml`
   - `https://qrstars.ru/sitemap-index.xml`
   - `https://qrstars.ru/sitemap-0.xml`
   - `https://qrstars.ru/404.html`

2. Submit the sitemap in webmaster tools:
   - Yandex Webmaster: `https://qrstars.ru/sitemap-index.xml`
   - Google Search Console: `https://qrstars.ru/sitemap-index.xml`

3. Configure the primary domain redirect at the hosting, CDN, or DNS proxy layer:
   - `https://www.qrstars.ru/*` -> `https://qrstars.ru/*`
   - redirect type: `301`
   - preserve path and query string

4. Verify redirect behavior:

```bash
curl -I https://www.qrstars.ru/
curl -I https://www.qrstars.ru/qr-menu.html
```

Expected result: both responses should be `301` with `Location` pointing to `https://qrstars.ru/...`.

## Example nginx redirect

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name www.qrstars.ru;

    return 301 https://qrstars.ru$request_uri;
}
```
