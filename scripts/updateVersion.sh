#!/bin/bash
version=$(git describe --tags --exact-match HEAD 2>/dev/null || git rev-parse --short HEAD)

echo "export const publicVersion = \"$version\";" > ./dist/public_version.ts