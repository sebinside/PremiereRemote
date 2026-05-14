#!/bin/bash

# Prepare UXP plugin
cd uxp
pnpm install -y

# Prepare server
cd ../server
pnpm install -y
