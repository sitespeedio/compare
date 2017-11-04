#!/bin/bash
set -e

# You need np and gulp for this to work
# npm install --global np
# npm install --global gulp-cli
np $1
npm run build

PACKAGE_VERSION=$(node -e 'console.log(require("./package").version)')
echo $PACKAGE_VERSION  > ../sitespeed.io/docs/version/compare.txt