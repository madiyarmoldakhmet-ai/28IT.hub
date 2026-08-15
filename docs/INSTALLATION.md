# 🚀 Пошаговое руководство по установке Gitea на Raspberry Pi 5

Данное руководство содержит инструкцию по развертыванию школьного Git-форжа на базе **Raspberry Pi OS 64-bit**.

---

## 1. Подготовка системы

Обновите пакеты ОС и установите необходимый системный софт:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git postgresql postgresql-contrib unzip rsync curl
```

---

## 2. Создание системного пользователя `git`

```bash
sudo adduser \
   --system \
   --shell /bin/bash \
   --gecos 'Git Version Control' \
   --group \
   --disabled-password \
   --home /home/git \
   git
```

---

## 3. Настройка базы данных PostgreSQL

Выполните установку базы данных из прилагаемого SQL-скрипта:

```bash
sudo -u postgres psql -f scripts/setup_db.sql
```

---

## 4. Загрузка и установка бинарного файла Gitea (ARM64)

```bash
# Скачивание сборки для ARM64 (Raspberry Pi 5)
VER="1.22.1"
curl -sL https://dl.gitea.com/gitea/${VER}/gitea-${VER}-linux-arm64 -o /tmp/gitea

# Перемещение и назначение прав
sudo mv /tmp/gitea /usr/local/bin/gitea
sudo chmod +x /usr/local/bin/gitea
```

---

## 5. Создание каталогов и копирование конфигурации

```bash
# Создание рабочих каталогов
sudo mkdir -p /var/lib/gitea/{custom,data,log,git/repositories}
sudo mkdir -p /etc/gitea

# Назначение владельцем пользователя git
sudo chown -R git:git /var/lib/gitea/
sudo chown -R git:git /etc/gitea

# Копирование конфигурационного файла app.ini
sudo cp config/app.ini /etc/gitea/app.ini
sudo chown git:git /etc/gitea/app.ini
sudo chmod 600 /etc/gitea/app.ini
```

---

## 6. Настройка и запуск службы Systemd

```bash
# Скопируйте файл службы в системный каталог
sudo cp systemd/gitea.service /etc/systemd/system/gitea.service

# Перезагрузите конфигурацию systemd и запустите сервис
sudo systemctl daemon-reload
sudo systemctl enable --now gitea

# Проверьте статус службы
sudo systemctl status gitea
```

Сервис будет доступен в школьной сети по адресу: `http://<IP-адрес-Raspberry-Pi>:3000/`.
