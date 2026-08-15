# 📖 Эксплуатационный регламент (Runbook) администратора

Данный регламент предназначен для системных администраторов и учителей информатики, обслуживающих школьный Git-форж на Raspberry Pi 5.

---

## 🛠 1. Основные команды управления сервисом

| Действие | Команда |
|---|---|
| Просмотр статуса службы | `sudo systemctl status gitea` |
| Запуск службы | `sudo systemctl start gitea` |
| Остановка службы | `sudo systemctl stop gitea` |
| Перезапуск службы | `sudo systemctl restart gitea` |
| Просмотр логов в реальном времени | `sudo journalctl -u gitea -f -n 100` |

---

## 💾 2. Резервное копирование и восстановление

### Ручной запуск бэкапа
Для создания полного дампа репозиториев, конфигураций и базы данных выполните:
```bash
sudo ./scripts/backup_gitea.sh
```
Все архивы сохраняются в `/var/backups/gitea/gitea-dump-YYYYMMDD_HHMMSS.zip`.

### Настройка автоматического бэкапа (Cron)
Добавьте задание в `crontab` пользователя `root` для ежедневного создания бэкапа в 02:00:
```bash
# sudo crontab -e
0 2 * * * /bin/bash /path/to/28IT.hub/scripts/backup_gitea.sh >> /var/log/gitea_backup.log 2>&1
```

### Восстановление из бэкапа
Для восстановления системы из архива выполните:
```bash
sudo ./scripts/restore_gitea.sh /var/backups/gitea/gitea-dump-20260815_020000.zip
```

---

## 🔍 3. Устранение неисправностей (Troubleshooting)

### Проблема A: Недоступен веб-интерфейс (Порт 3000)
1. Проверьте запущен ли процесс: `sudo systemctl status gitea`.
2. Проверьте занятость порта: `sudo ss -tulpn | grep 3000`.
3. Проверьте логи на наличие ошибок подключения к БД: `tail -n 50 /var/lib/gitea/log/gitea.log`.

### Проблема B: Переполнение накопителя Raspberry Pi 5
1. Проверьте свободное место: `df -h /var/lib/gitea`.
2. Удалите устаревшие логи: `sudo journalctl --vacuum-time=7d`.
3. Запустите очистку старых бэкапов: `sudo find /var/backups/gitea/ -mtime +14 -delete`.
