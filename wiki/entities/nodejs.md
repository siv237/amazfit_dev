---
type: entity
tags: [nodejs, nvm, tool]
status: ok
updated: 2026-09-12
sources: [raw/promt-agent-zeppos-gts4-ubuntu.md]
---

# Node.js и nvm

Для Zeus CLI используется **Node.js 20 LTS**.

- В системе изначально был **Node v23.0.0** (нечётный, не LTS) — заменён.
- nvm: **0.40.1**, установлен в `~/.nvm`; инициализация добавлена в `~/.bashrc`.
- Активная версия: **v20.20.2**, npm **10.8.2**; `nvm alias default 20`.

## Установка

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20
nvm use 20
```

## Замечание для скриптов

В неинтерактивном shell после `nvm use` нужно сбросить кэш команд bash, иначе `node`
может резолвиться в старый системный бинарь:

```
. "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null; hash -r; node -v
```

## Связанные страницы

- [../procedures/setup-ubuntu.md](../procedures/setup-ubuntu.md)
- [../entities/zeus-cli.md](../entities/zeus-cli.md)
