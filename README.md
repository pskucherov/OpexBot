# OpexBot

## Требования
```
node >= 17
```

## Установка и запуск

### Из npm
```
mkdir robot
cd robot
npm i opexbot
npx opexbot
```

### Из репозитория
```
git clone https://github.com/pskucherov/OpexBot
cd OpexBot
npm i
npm start
```

### Порты
По умолчанию используется 3000 и 8000 порты. Для их изменения используйте PORT и SERVERPORT соответственно.
```
PORT=3006 SERVERPORT=8006 npx opexbot
```

## Модули
1. [SDK](https://www.npmjs.com/package/tinkoff-sdk-grpc-js) (forked from mtvkand/invest-nodejs-grpc-sdk)
> В основной репозиторий добавил appname, обновил proto и список ошибок, добавил возможность проброса метода для логирования ([раз](https://github.com/mtvkand/invest-nodejs-grpc-sdk/pull/3/commits), [два](https://github.com/mtvkand/invest-nodejs-grpc-sdk/pull/7/commits)). В форке привёл экспорт к нужному мне виду и вынес в npm.

2. [Connector](https://www.npmjs.com/package/tinkofftradingbot) [^1]
> Библиотека, связывающая терминал, sdk и робота. Ведёт журнал логов по дням, кеширует данные от брокера и сохраняет настройки из терминала.

3. [Terminal](https://www.npmjs.com/package/opexviewer)
> Пользовательский инетрфейс для бектестирования и дневной торговли.

4. Непосредственно сам (робот)(https://www.npmjs.com/package/opexbot)
> Состоит из основного класса обработки данных Common, наследуемого от него Backtest для обработки данных в режиме бектестирования и класса робота, в котором реализуется торговая стратегия.


[^1]: Изначально это должен был быть сам робот. Но из-за большого объёма кода решил разделить логику, чтобы не пугать неподготовленных пользователей.
