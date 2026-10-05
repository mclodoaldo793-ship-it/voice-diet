# voice-diet

Материалы 3D-сферы VoiceDiet и инструкции для Claude Motion Director.

- [voicediet-orb/README.md](voicediet-orb/README.md) — устройство модели, запуск просмотрщика и пересборка.
- `voicediet-orb/` — полная копия исходной папки: Blender, GLB, просмотрщик, скрипты, референсы, рендеры и QA.
- [voicediet-orb/voice-orb/README.md](voicediet-orb/voice-orb/README.md) — анимированная сфера для экрана голосового ввода (компонент, предпросмотр, видео).
- [Claude_Motion_Studio.txt](Claude_Motion_Studio.txt) — исходный документ Claude Motion Studio.
- [CLAUDE.md](CLAUDE.md) — правила работы Claude с анимацией.
- [.claude/skills/motion-director/SKILL.md](.claude/skills/motion-director/SKILL.md) — навык Motion Director с приложенными стандартами дизайна и проверки рендера.

Просмотр сферы из корня репозитория:

```sh
py -m http.server 8765 --bind 127.0.0.1 --directory voicediet-orb
```

Откройте http://127.0.0.1:8765/viewer/ (модель) или http://127.0.0.1:8765/voice-orb/ (анимация голосового ввода).

Для работы с Motion Director откройте репозиторий в Claude Code и используйте `/motion-director` с заданием на ролик.
