#!/bin/bash

screen -X -S Registry quit

cd $(dirname "$0")/../
git pull

yarn

screen -dmS Registry -L yarn nodemon index.js
