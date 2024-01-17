# OpexBot

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
### UI
```
npx ts-node opexbot.js
```

После старта откройте http://localhost:3056/settings
Pin: 0000

[Обзор UI версии](https://opexflow.com/kit)

### Консольная версия
```
npx ts-node ./bots/backtester/backtester.ts
```

#### DEBUG-режим
```
npx cross-env DEBUG=1 ts-node ./bots/backtester/backtester.ts
```
