---
type: procedure
tags: [setup, ubuntu, install]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Процедура: установка среды (Ubuntu 24.04)

Шаги 1–5 исходного промта. Проверено на Ubuntu 24.04.4 LTS amd64.

## Шаг 1. Система и базовые пакеты

```
lsb_release -a
dpkg --print-architecture
sudo apt-get update
sudo apt-get install -y build-essential ca-certificates curl git
```

`build-essential`, `curl`, `git`, `ca-certificates` уже присутствовали.

## Шаг 2. Node.js 20 LTS (через nvm)

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$HOME/.nvm/nvm.sh"
nvm install 20
nvm alias default 20
```

В неинтерактивных скриптах после `nvm use 20` вызывать `hash -r`.

## Шаг 3. Zeus CLI

```
npm i @zeppos/zeus-cli -g
zeus -v        # 1.9.3
```

## Шаг 4. VS Code и каталог проектов

```
code --version          # 1.120.0
mkdir -p ~/zepp-dev
```

Расширение `Zepp.zeppos-dev-tools` снято с маркетплейса — установка не требуется.

## Шаг 5. Симулятор

```
curl -sL -o /tmp/simulator.deb \
  "https://upload-cdn.zepp.com/zepp-applet-and-wechat-applet/20260717/simulator_2.1.2_linux_amd64.deb"
sudo dpkg -i /tmp/simulator.deb
sudo apt-get install -y libaio1t64
sudo ln -sf /lib/x86_64-linux-gnu/libaio.so.1t64 /usr/lib/x86_64-linux-gnu/libaio.so.1
sudo ldconfig
```

Дальше — загрузка образа часов и патч сети QEMU, см.
[simulator-dev.md](simulator-dev.md).

## Проверка

```
zeus -v
node -v
dpkg -l | grep simulator
```

## Связанные страницы

- [../entities/nodejs.md](../entities/nodejs.md)
- [../entities/zeus-cli.md](../entities/zeus-cli.md)
- [simulator-dev.md](simulator-dev.md)
