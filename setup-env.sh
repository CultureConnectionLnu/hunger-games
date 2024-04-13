#!/bin/bash

if [ -d env ]; then
    cd env
    git pull
    exit 0
fi

# get the environment variables
git clone https://github.com/CultureConnectionLnu/hunger-games-env.git env

# only copy the .env file if it does not already exist in the app folder
if [ ! -f app/.env ]; then
    cp env/.env app/.env
fi