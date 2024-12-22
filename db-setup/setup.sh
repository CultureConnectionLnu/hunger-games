#!/bin/sh

while ! pg_isready -d $DATABASE_URL; 
    do sleep 1; 
done 

pnpm run db:push