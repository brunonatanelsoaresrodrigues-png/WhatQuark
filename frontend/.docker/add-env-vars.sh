_writeFrontendEnvVars() {
    ENV_JSON="$(jq --compact-output --null-input 'env | with_entries(select((.key | startswith("REACT_APP_")) or (.key | startswith("VITE_"))))')"
    printf 'window.ENV=%s;\n' "${ENV_JSON}" > "${PUBLIC_HTML}runtime-config.js"
}

_writeNginxEnvVars() {
    dockerize -template /etc/nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf
}

_addSslConfig() {
    SSL_CERTIFICATE=/etc/nginx/ssl/${1}/fullchain.pem;
    SSL_CERTIFICATE_KEY=/etc/nginx/ssl/${1}/privkey.pem;
    FILE_CONF=/etc/nginx/sites.d/${1}.conf
    FILE_SSL_CONF=/etc/nginx/conf.d/00-ssl-redirect.conf;

    if [ -f ${SSL_CERTIFICATE} ] && [ -f ${SSL_CERTIFICATE_KEY} ]; then
        echo "saving ssl config in ${FILE_CONF}"
        echo 'include include.d/ssl-redirect.conf;' >> ${FILE_SSL_CONF};
        echo 'include "include.d/ssl.conf";' >> ${FILE_CONF};
        echo "ssl_certificate ${SSL_CERTIFICATE};" >> ${FILE_CONF};
        echo "ssl_certificate_key ${SSL_CERTIFICATE_KEY};" >> ${FILE_CONF};
    else
        echo 'listen 80;' >> ${FILE_CONF};
        echo "ssl ${1} not found >> ${SSL_CERTIFICATE} -> ${SSL_CERTIFICATE_KEY}"
    fi;
}

_writeFrontendEnvVars;
_writeNginxEnvVars;

_addSslConfig 'backend'
_addSslConfig 'frontend'
