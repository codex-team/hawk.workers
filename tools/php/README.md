# Php bomber

Script for sending PHP errors to the Hawk catcher.

## How to run

Prepare `.env` config

    cp .env.sample .env

You can run the script in two modes: single run (`once`) and periodic run (`interval`)

### Run once

    php bomber.php once

or also

    php bomber.php

### Run with interval

Run command `php bomber.php interval [seconds]`

Example with one minute interval

    php bomber.php interval 60
