#!/bin/bash
# Reload nginx after certbot renew (installed to /etc/letsencrypt/renewal-hooks/deploy/)
nginx -t && systemctl reload nginx
