# OpexBot

# Описание: [https://opexflow.com/kit](https://opexflow.com/kit)

# Установка: [здесь](https://articles.opexflow.com/software-trading/kak-ustanovit-i-zapustit-torgovogo-pomoshhnika-opexbot-dlya-tinkoff-investicii.htm)

# Обновление: [здесь](https://articles.opexflow.com/programming/kak-obnovit-opexbot-s-soxraneniem-nastroek-na-windows.htm)

## Требования
```
node >= 17
```

## Установка

```
git clone https://github.com/pskucherov/OpexBot
cd OpexBot
npm i
```

## Запуск
### UI (для непрограммистов)
```
npx ts-node opexbot.js
```

После старта откройте http://localhost:3056/settings
Pin: 0000

[Обзор UI версии](https://opexflow.com/kit)

### Консольная версия (для программистов)
```
npx ts-node ./bots/backtester/backtester.ts
```

#### DEBUG-режим
```
npx cross-env DEBUG=1 ts-node ./bots/backtester/backtester.ts
```

## Для вопросов и предложений
[Личка](https://t.me/opexbotru)
[Чат](https://t.me/opexflowchat)
