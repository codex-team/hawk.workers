#!/bin/bash

set -e

USER="registry"
node=$(which node)
PWD=$(pwd)

id -u $USER 2>/dev/null

if [[$? == 1 ]]; then
    useradd -m -s /bin/bash $USER
fi

sed "s|\/home\/registry\/.nvm\/versions\/node\/v11.2.0\/bin\/node|$node|" < registry.service | sed "s|\/home\/registry\/registry\/index.js|$PWD\/index.js|" > /lib/systemd/system/registry.service

systemctl daemon-reload
