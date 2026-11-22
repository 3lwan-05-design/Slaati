@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d C:\s\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain