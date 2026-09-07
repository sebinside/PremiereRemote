#!/bin/bash

# Prepare UXP plugin
cd client
pnpm install -y

# Prepare server
cd ../server
pnpm install -y
