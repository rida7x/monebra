@echo off
chcp 65001 >nul
title Monebra Perfume - Store Server

REM  Thin launcher for win-server.ps1, which holds the actual logic.
REM  pushd first, then a relative script path: the folder name contains
REM  Arabic letters, and a path spelled out on a command line can arrive
REM  mangled through the console code page. The working directory does not.
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\win-server.ps1"
popd
