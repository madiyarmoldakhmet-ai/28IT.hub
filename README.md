# 🏫 Школьный Git-форж (Gitea) для «Умной Школы»

![Gitea Infrastructure](https://img.shields.io/badge/Platform-Raspberry%20Pi%205-red?style=for-the-badge&logo=raspberrypi)
![Gitea](https://img.shields.io/badge/Git%20Forge-Gitea%20v1.22-green?style=for-the-badge&logo=gitea)
![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20SQLite-blue?style=for-the-badge&logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)

Добро пожаловать в репозиторий конфигурации и развертывания **автономного школьного Git-сервиса (форжа)** на базе **Gitea** для проекта «Умная Школа». Данное решение предназначено для обеспечения независимой, высокопроизводительной и защищенной среды командной разработки и контроля версий без использования сторонних облачных сервисов.

---

## 📌 Основные возможности

- **Автономное развертывание на Raspberry Pi 5**: Спроектировано под 64-битную ОС ARM64 с поддержкой PostgreSQL.
- **Полная изоляция от внешнего интернета**: Сервис функционирует в защищенной локальной сети школы.
- **Поддержка HTTP и SSH**: Безопасный доступ для клонирования и отправки кода.
- **Интегрированные скрипты обслуживание**: Автоматическое резервное копирование и восстановление после сбоев.
- **Готовые регламенты и регламент применения**: Инструкции для администраторов, преподавателей и учеников.

---

## 📂 Структура репозитория

```
28IT.hub/
├── README.md               # Главное описание проекта
├── .gitignore              # Исключения версионирования для инфраструктуры
├── config/                 # Конфигурационные файлы
│   └── app.ini             # Продакшн-конфигурация Gitea для Raspberry Pi 5
├── systemd/                # Файлы служб Linux
│   └── gitea.service       # Системный юнит systemd для запуска Gitea
├── scripts/                # Скрипты развертывания и бэкапа
│   ├── setup_db.sql        # Скрипт инициализации БД PostgreSQL и пользователя
│   ├── backup_gitea.sh     # Скрипт автоматического ежедневного бэкапа
│   └── restore_gitea.sh    # Скрипт восстановления из резервной копии
└── docs/                   # Полный комплект документации
    ├── PLAN.md             # Архитектурный план и аппаратная топология
    ├── INSTALLATION.md     # Пошаговая инструкция по установке на Raspberry Pi 5
    ├── RUNBOOK.md          # Операционный регламент администратора
    └── RULES.md            # Правила работы с Git для учеников и преподавателей
```

---

## 🚀 Быстрый старт

1. Ознакомьтесь с [Архитектурным планом](file:///Users/gulnaz_7580mail.ru/Documents/28IT.hub/docs/PLAN.md).
2. Следуйте [Инструкции по установке](file:///Users/gulnaz_7580mail.ru/Documents/28IT.hub/docs/INSTALLATION.md).
3. Примените конфигурацию [config/app.ini](file:///Users/gulnaz_7580mail.ru/Documents/28IT.hub/config/app.ini) и службу [systemd/gitea.service](file:///Users/gulnaz_7580mail.ru/Documents/28IT.hub/systemd/gitea.service).
4. Ознакомьте администраторов с [Runbook](file:///Users/gulnaz_7580mail.ru/Documents/28IT.hub/docs/RUNBOOK.md).

---

## 🛠 Технологический стек

- **Сервер**: Raspberry Pi 5 (8 GB RAM)
- **ОС**: Raspberry Pi OS (64-bit Debian Bookworm)
- **Git-движок**: Gitea (v1.22+ ARM64)
- **СУБД**: PostgreSQL 15 / SQLite3
- **Служба**: Systemd
