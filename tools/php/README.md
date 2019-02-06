# Php bomber

Script for throwing php error to catcher.

## How to run

Prepare `.env` config

    cp .env.sample .env

You can run in two modes: one-time error(once) and non-stop with interval

### Run once

    php bomber.php once

or also

    php bomber.php

### Run with interval

Run command `php bomber.php interval [seconds]`

Example with one minute interval

    php bomber.php interval 60