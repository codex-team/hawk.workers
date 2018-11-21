#!/bin/bash

screen -X -S Registry quit

cd /root/registry
git pull

yarn

screen -dmS Registry -L yarn nodemon index.js
