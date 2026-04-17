@echo off
if "%1"=="clean" goto clean 
goto test
:clean
echo Recompile clean
call npx hardhat clean
call npx hardhat compile
echo.
goto test
:test
echo Tests running
call npx hardhat test test/integration/init.test.ts --coverage
call npx hardhat test test/unit/VaultPrudentGlUSDP.test.ts --coverage