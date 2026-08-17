# 📖 Эксплуатационный регламент (Runbook) администратора 28IT.hub

Данное руководство содержит стандартные операционные процедуры для системных администраторов, обслуживающих школьный Git-форж Gitea на **Raspberry Pi 5**.

---

## 🛠 1. Мониторинг и Управление Службой

```bash
# Просмотр статуса службы Gitea
sudo systemctl status gitea

# Запуск, остановка и перезапуск
sudo systemctl start gitea
sudo systemctl stop gitea
sudo systemctl restart gitea

# Просмотр логов процесса в реальном времени
sudo journalctl -u gitea -f -n 100
```

---

## 💾 2. Резервное копирование (Backup)

Резервное копирование выполняется утилитой `gitea dump`. Инструмент упаковывает базу данных, репозитории, конфигурационные файлы и вложения в единственный zip-архив.

### Команда выполнения дампа:
```bash
sudo -u git gitea dump -c /etc/gitea/app.ini --tempdir /tmp --file /var/backups/gitea/gitea-dump-$(date +%Y%m%d_%H%M%S).zip
```

### Настройка регулярного бэкапа в Crontab:
```bash
# sudo crontab -e
0 2 * * * sudo -u git gitea dump -c /etc/gitea/app.ini --tempdir /tmp --file /var/backups/gitea/gitea-dump-$(date +\%Y\%m\%d_\%H\%M\%S).zip
```

---

## 🔄 3. Восстановление из Бэкапа (Restore)

В случае сбоя или миграции на новое оборудование выполните пошаговую процедуру развертки архива:

```bash
# 1. Остановка службы
sudo systemctl stop gitea

# 2. Распаковка архива во временный каталог
mkdir -p /tmp/gitea-restore
unzip /var/backups/gitea/gitea-dump-20260815_020000.zip -d /tmp/gitea-restore

# 3. Восстановление репозиториев и вложений
rsync -avz /tmp/gitea-restore/repos/ /var/lib/gitea/git/repositories/
rsync -avz /tmp/gitea-restore/data/ /var/lib/gitea/data/
cp /tmp/gitea-restore/app.ini /etc/gitea/app.ini

# 4. Восстановление базы данных PostgreSQL
sudo -u postgres psql -d gitea -f /tmp/gitea-restore/gitea-db.sql

# 5. Сброс прав владельца и запуск службы
sudo chown -R git:git /var/lib/gitea/ /etc/gitea/
sudo systemctl start gitea
rm -rf /tmp/gitea-restore
```

---

## ⬆️ 4. Процедура Обновления Gitea

При выходе новой версии бинарника Gitea выполняется процедура безопасной замены:

```bash
# 1. Остановка службы
sudo systemctl stop gitea

# 2. Создание резервной копии текущего бинарника
sudo cp /usr/local/bin/gitea /usr/local/bin/gitea.bak

# 3. Скачивание новой версии ARM64
NEW_VER="1.23.0"
curl -sL "https://dl.gitea.com/gitea/${NEW_VER}/gitea-${NEW_VER}-linux-arm64" -o /tmp/gitea
sudo mv /tmp/gitea /usr/local/bin/gitea
sudo chmod +x /usr/local/bin/gitea

# 4. Запуск службы и проверка версии
sudo systemctl start gitea
gitea --version
```

---

## 🔍 5. Траблшутинг (Troubleshooting)

### А. Сброс пароля администратора
Если администратор забыл пароль от учетной записи `admin`, выполните сброс через CLI утилиту от имени пользователя `git`:

```bash
sudo -u git gitea admin user change-password --username admin --password "NewSecurePassword123!" -c /etc/gitea/app.ini
```

### Б. Нехватка места на диске Raspberry Pi 5
1. Проверьте свободное место: `df -h /var/lib/gitea`.
2. Очистите старые бэкапы: `find /var/backups/gitea/ -name "*.zip" -mtime +14 -delete`.
3. Запустите внутреннюю очистку Git-репозиториев:
   ```bash
   sudo -u git gitea admin cleanup-hook-task -c /etc/gitea/app.ini
   ```

### В. Сервис не запускается (`gitea.service failed`)
1. Проверьте журнал ошибок: `sudo journalctl -u gitea -n 50 --no-pager`.
2. Проверьте права на конфигурационный файл: `ls -la /etc/gitea/app.ini` (должно быть `git:git`, `600`).
3. Проверьте доступность базы данных PostgreSQL: `sudo -u postgres psql -c '\l'`.
